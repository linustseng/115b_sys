import React, { useEffect, useRef, useState } from "react";
import {
  addDays_,
  addMinutes_,
  generateEventId_,
  pad2_,
  parseLocalInputDate_,
  toLocalInput_,
  toLocalInputValue_,
} from "../adminUtils";

export default function AdminPage({
  apiRequest,
  API_URL,
  buildGoogleMapsUrl_,
  formatDisplayDate_,
  getGroupLabel_,
  PUBLIC_SITE_URL,
  GROUP_ROLE_LABELS,
  ROLE_BADGE_STYLES,
  EVENT_CATEGORIES,
  CLASS_GROUPS,
  initialTab = "events",
  allowedTabs = ["events", "ordering", "registrations", "checkins", "students"],
}) {
  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [orderPlans, setOrderPlans] = useState([]);
  const [orderResponses, setOrderResponses] = useState([]);
  const [orderActiveId, setOrderActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");
  const [activeTab, setActiveTab] = useState(() =>
    allowedTabs.includes(initialTab) ? initialTab : allowedTabs[0]
  );
  const [seedTimestamp, setSeedTimestamp] = useState(Date.now());
  const [form, setForm] = useState({
    id: "",
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    location: "",
    address: "",
    registrationOpenAt: "",
    registrationCloseAt: "",
    checkinOpenAt: "",
    checkinCloseAt: "",
    registerUrl: "",
    checkinUrl: "",
    capacity: "",
    status: "draft",
    category: "gathering",
    allowCompanions: "yes",
    allowBringDrinks: "yes",
    attachments: "[]",
  });
  const [registrationForm, setRegistrationForm] = useState({
    id: "",
    status: "registered",
  });
  const [copyStatus, setCopyStatus] = useState("");
  const [registerCopyStatus, setRegisterCopyStatus] = useState("");
  const [registrationEventId, setRegistrationEventId] = useState("");
  const [checkinEventId, setCheckinEventId] = useState("");
  const [orderStatusMessage, setOrderStatusMessage] = useState("");
  const [orderForm, setOrderForm] = useState({
    id: "",
    date: "",
    title: "",
    optionA: "A 餐",
    optionB: "B 餐",
    optionAImage: "",
    optionBImage: "",
    cutoffAt: "",
    status: "open",
    notes: "",
  });
  const [studentsQuery, setStudentsQuery] = useState("");
  const [unregisteredQuery, setUnregisteredQuery] = useState("");
  const [registrationStatusMessage, setRegistrationStatusMessage] = useState("");
  const [groupMemberships, setGroupMemberships] = useState([]);
  const [draftMemberships, setDraftMemberships] = useState([]);
  const [membershipDirty, setMembershipDirty] = useState(false);
  const [membershipQuery, setMembershipQuery] = useState("");
  const [membershipStatus, setMembershipStatus] = useState("");
  const [membershipSaveError, setMembershipSaveError] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [pinnedGroupId, setPinnedGroupId] = useState("");
  const [directoryToken, setDirectoryToken] = useState(
    () => localStorage.getItem("directoryToken") || ""
  );
  const [attachmentUrlInput, setAttachmentUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadFormRef = useRef(null);
  const uploadFileRef = useRef(null);
  const uploadCompletedRef = useRef(false);

  const normalizeEventId_ = (value) => String(value || "").trim();
  const normalizeOrderId_ = (value) => String(value || "").trim();

  const normalizeEmail_ = (value) => String(value || "").trim().toLowerCase();

  const normalizeName_ = (value) => String(value || "").trim();

  const getDisplayName_ = (student) =>
    String(
      (student && (student.preferredName || student.nameZh || student.nameEn || student.name)) || ""
    ).trim();

  const buildMembershipKey_ = (membership) =>
    `${String(membership.personId || "").trim()}::${String(membership.groupId || "").trim()}::${String(
      membership.roleInGroup || ""
    ).trim()}`;

  const getMembershipRoleLabel_ = (membership) => {
    if (!membership) {
      return "";
    }
    if (membership.groupId === "A") {
      if (membership.roleInGroup === "lead") {
        return "班代";
      }
      if (membership.roleInGroup === "deputy") {
        return "副班代";
      }
    }
    return GROUP_ROLE_LABELS[membership.roleInGroup] || membership.roleInGroup || "-";
  };

  const getMembershipRoleStyleKey_ = (membership) => {
    if (!membership) {
      return "member";
    }
    if (membership.groupId === "A") {
      if (membership.roleInGroup === "lead") {
        return "rep";
      }
      if (membership.roleInGroup === "deputy") {
        return "repDeputy";
      }
    }
    return membership.roleInGroup || "member";
  };

  const normalizePersonId_ = (value) => String(value || "").trim();

  const parseEventAttachments_ = (value) => {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const matchesStudentQuery_ = (item, query) => {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) {
      return true;
    }
    const haystack = [
      item.id,
      item.email,
      item.googleEmail,
      item.name,
      item.nameZh,
      item.nameEn,
      item.preferredName,
      item.company,
      item.title,
      item.dietaryRestrictions,
      item.group,
      item.googleSub,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(needle);
  };

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

  const normalizeBaseUrl_ = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      return "";
    }
    return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  };

  const normalizeEventDateTimeValue_ = (value) => {
    if (!value) {
      return "";
    }
    if (value instanceof Date) {
      return toLocalInputValue_(value);
    }
    if (typeof value === "number") {
      const parsedNumber = new Date(value);
      return isNaN(parsedNumber.getTime()) ? "" : toLocalInputValue_(parsedNumber);
    }
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    const normalized =
      /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(raw)
        ? raw.replace(/\//g, "-").replace(" ", "T")
        : raw;
    const parsed = parseLocalInputDate_(normalized);
    if (parsed) {
      return toLocalInputValue_(parsed);
    }
    const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}T${isoMatch[2]}`;
    }
    return normalized;
  };

  const parseEventDateValue_ = (value) => {
    if (!value) {
      return null;
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

  const sortedEvents = events
    .slice()
    .sort((a, b) => {
      const aClosed = isEventClosed_(a);
      const bClosed = isEventClosed_(b);
      if (aClosed !== bClosed) {
        return aClosed ? 1 : -1;
      }
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

  const formatOrderDateLabel_ = (value) => {
    const parsed = parseLocalInputDate_(value);
    if (!parsed) {
      return value || "-";
    }
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][parsed.getDay()];
    return `${parsed.getFullYear()}-${pad2_(parsed.getMonth() + 1)}-${pad2_(
      parsed.getDate()
    )} (${weekday})`;
  };

  const normalizeDateInput_ = (value) => {
    if (!value) {
      return "";
    }
    const parsed = parseLocalInputDate_(value);
    return parsed ? toDateInputValue_(parsed) : String(value || "");
  };

  const normalizeDateTimeInput_ = (value) => {
    if (!value) {
      return "";
    }
    const parsed = parseLocalInputDate_(value);
    return parsed ? toLocalInputValue_(parsed) : String(value || "");
  };

  const toDateInputValue_ = (date) => {
    if (!date) {
      return "";
    }
    return `${date.getFullYear()}-${pad2_(date.getMonth() + 1)}-${pad2_(date.getDate())}`;
  };

  const getNextWeekendDate_ = () => {
    const base = new Date();
    for (let step = 1; step <= 14; step += 1) {
      const next = addDays_(base, step);
      if (next.getDay() === 6 || next.getDay() === 0) {
        return next;
      }
    }
    return addDays_(base, 7);
  };

  const buildDefaultOrderForm = () => {
    const baseDate = getNextWeekendDate_();
    const dateValue = toDateInputValue_(baseDate);
    const cutoffAt = toLocalInput_(addDays_(baseDate, -1), 23, 59);
    return {
      id: "",
      date: dateValue,
      title: dateValue ? `訂餐 ${dateValue}` : "",
      optionA: "A 餐",
      optionB: "B 餐",
      optionAImage: "",
      optionBImage: "",
      cutoffAt: cutoffAt,
      status: "open",
      notes: "",
    };
  };

  const buildDefaultForm = (items) => {
    const baseDate = addDays_(new Date(), 10);
    const startAt = toLocalInput_(baseDate, 19, 0);
    const endAt = toLocalInput_(baseDate, 21, 0);
    const registrationOpenAt = toLocalInput_(addDays_(baseDate, -14), 9, 0);
    const registrationCloseAt = toLocalInput_(addDays_(baseDate, -2), 23, 0);
    const checkinOpenAt = toLocalInput_(baseDate, 18, 0);
    const checkinCloseAt = toLocalInput_(baseDate, 20, 30);
    const eventId = generateEventId_(baseDate, "gathering", items, seedTimestamp);
    const baseUrl = normalizeBaseUrl_(PUBLIC_SITE_URL) || window.location.origin;
    const registerUrl = `${baseUrl}/register?eventId=${encodeURIComponent(eventId)}`;
    const checkinUrl = `${baseUrl}/checkin?eventId=${encodeURIComponent(eventId)}`;
    return {
      id: eventId,
      title: "",
      description: "",
      startAt: startAt,
      endAt: endAt,
      location: "",
      address: "",
      registrationOpenAt: registrationOpenAt,
      registrationCloseAt: registrationCloseAt,
      checkinOpenAt: checkinOpenAt,
      checkinCloseAt: checkinCloseAt,
      registerUrl: registerUrl,
      checkinUrl: checkinUrl,
      capacity: "60",
      status: "draft",
      category: "gathering",
      allowCompanions: "yes",
      allowBringDrinks: "yes",
      attachments: "[]",
    };
  };

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listEvents" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setEvents(result.data && result.data.events ? result.data.events : []);
    } catch (err) {
      setError("活動列表載入失敗。");
    } finally {
      setLoading(false);
    }
  };

  const hasEventDataTabs =
    allowedTabs.includes("events") ||
    allowedTabs.includes("registrations") ||
    allowedTabs.includes("checkins");
  const isMembershipSaving = activeTab === "roles" && saving;

  useEffect(() => {
    if (hasEventDataTabs) {
      loadAdminBootstrap().then((ok) => {
        if (!ok) {
          loadEvents();
        }
      });
    }
  }, [hasEventDataTabs]);

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] || "events");
    }
  }, [activeTab, allowedTabs]);

  useEffect(() => {
    if (!isMembershipSaving) {
      return;
    }
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isMembershipSaving]);

  useEffect(() => {
    if (activeTab === "registrations") {
      loadRegistrations();
      if (!students.length || !events.length) {
        loadAdminBootstrap();
      }
      loadDirectoryAdmin();
    }
    if (activeTab === "checkins") {
      loadCheckins();
      loadRegistrations();
      if (!students.length || !events.length) {
        loadAdminBootstrap();
      }
      loadDirectoryAdmin();
    }
    if (activeTab === "students") {
      if (!students.length) {
        loadAdminBootstrap();
      } else {
        loadStudents();
      }
      loadDirectoryAdmin();
    }
    if (activeTab === "roles") {
      if (!groupMemberships.length || !students.length) {
        loadAdminBootstrap();
      } else {
        loadGroupMemberships();
        loadStudents();
      }
    }
    if (activeTab === "ordering") {
      loadOrderPlans();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "roles") {
      setMembershipSaveError("");
      setMembershipStatus("");
    }
  }, [activeTab]);

  useEffect(() => {
    if (!membershipStatus) {
      return;
    }
    const timer = setTimeout(() => {
      setMembershipStatus("");
    }, 3500);
    return () => clearTimeout(timer);
  }, [membershipStatus]);


  useEffect(() => {
    if (!activeId) {
      setForm(buildDefaultForm(events));
    }
  }, [activeId, events, seedTimestamp]);

  useEffect(() => {
    if (!registrationEventId && sortedEvents.length) {
      setRegistrationEventId(sortedEvents[0].id || "");
    }
    if (!checkinEventId && sortedEvents.length) {
      setCheckinEventId(sortedEvents[0].id || "");
    }
  }, [sortedEvents, registrationEventId, checkinEventId]);

  useEffect(() => {
    if (activeTab !== "ordering") {
      return;
    }
    if (!orderActiveId && orderPlans.length) {
      setOrderActiveId(normalizeOrderId_(orderPlans[0].id));
      return;
    }
    if (!orderActiveId && !orderPlans.length) {
      setOrderForm(buildDefaultOrderForm());
    }
  }, [activeTab, orderActiveId, orderPlans]);

  useEffect(() => {
    if (activeTab !== "ordering") {
      return;
    }
    if (orderActiveId) {
      const normalizedId = normalizeOrderId_(orderActiveId);
      loadOrderResponses(normalizedId);
      const selected = orderPlans.find(
        (plan) => normalizeOrderId_(plan.id) === normalizedId
      );
      if (selected) {
        setOrderForm({
          id: selected.id || "",
          date: normalizeDateInput_(selected.date),
          title: selected.title || "",
          optionA: selected.optionA || "A 餐",
          optionB: selected.optionB || "B 餐",
          optionAImage: selected.optionAImage || "",
          optionBImage: selected.optionBImage || "",
          cutoffAt: normalizeDateTimeInput_(selected.cutoffAt),
          status: selected.status || "open",
          notes: selected.notes || "",
        });
      }
    }
  }, [activeTab, orderActiveId, orderPlans]);

  useEffect(() => {
    const handleUploadMessage = (event) => {
      if (!event || !event.data || event.data.type !== "uploadResult") {
        return;
      }
      if (uploadCompletedRef.current) {
        return;
      }
      const payload = event.data.payload || {};
      uploadCompletedRef.current = true;
      setUploading(false);
      if (!payload.ok) {
        setUploadError(payload.error || "上傳失敗");
        return;
      }
      const attachment = payload.data || {};
      if (attachment.url) {
        setForm((prev) => {
          const current = parseEventAttachments_(prev.attachments);
          const next = current.concat([
            { name: attachment.name || attachment.url, url: attachment.url, fileId: attachment.fileId || "" },
          ]);
          return { ...prev, attachments: JSON.stringify(next) };
        });
      }
      setUploadError("");
    };
    window.addEventListener("message", handleUploadMessage);
    return () => window.removeEventListener("message", handleUploadMessage);
  }, []);

  const handleEdit = (event) => {
    setActiveId(event.id || "");
    setForm({
      id: event.id || "",
      title: event.title || "",
      description: event.description || "",
      startAt: normalizeEventDateTimeValue_(event.startAt),
      endAt: normalizeEventDateTimeValue_(event.endAt),
      location: event.location || "",
      address: event.address || "",
      registrationOpenAt: normalizeEventDateTimeValue_(event.registrationOpenAt),
      registrationCloseAt: normalizeEventDateTimeValue_(event.registrationCloseAt),
      checkinOpenAt: normalizeEventDateTimeValue_(event.checkinOpenAt),
      checkinCloseAt: normalizeEventDateTimeValue_(event.checkinCloseAt),
      registerUrl: event.registerUrl || "",
      checkinUrl: event.checkinUrl || "",
      capacity: event.capacity || "",
      status: event.status || "draft",
      category: event.category || "gathering",
      allowCompanions: event.allowCompanions || "yes",
      allowBringDrinks: event.allowBringDrinks || "yes",
      attachments: event.attachments || "[]",
    });
  };

  const loadStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listStudents" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setStudents(result.data && result.data.students ? result.data.students : []);
    } catch (err) {
      setError("同學名單載入失敗。");
    } finally {
      setLoading(false);
    }
  };

  const loadDirectoryAdmin = async () => {
    const storedToken = localStorage.getItem("directoryToken") || "";
    if (storedToken && storedToken !== directoryToken) {
      setDirectoryToken(storedToken);
    }
    const activeToken = storedToken || directoryToken;
    if (!activeToken) {
      setDirectory([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listDirectory", authToken: activeToken });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setDirectory(result.data && result.data.directory ? result.data.directory : []);
    } catch (err) {
      setDirectory([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrations = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listRegistrations" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setRegistrations(result.data && result.data.registrations ? result.data.registrations : []);
    } catch (err) {
      setError("報名名單載入失敗。");
    } finally {
      setLoading(false);
    }
  };

  const loadGroupMemberships = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listGroupMemberships" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const memberships = result.data && result.data.memberships ? result.data.memberships : [];
      setGroupMemberships(memberships);
      setDraftMemberships(memberships);
      setMembershipDirty(false);
      setMembershipStatus("");
    } catch (err) {
      setError(err.message || "班務分組載入失敗。");
    } finally {
      setLoading(false);
    }
  };

  const loadAdminBootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listAdminBootstrap" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const data = result.data || {};
      setEvents(data.events || []);
      const studentsList = data.students || [];
      setStudents(studentsList);
      setGroupMemberships(data.groupMemberships || []);
      setDraftMemberships(data.groupMemberships || []);
      setMembershipDirty(false);
      setMembershipStatus("");
      return true;
    } catch (err) {
      setError(err.message || "後台資料載入失敗。");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loadCheckins = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listCheckins" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setCheckins(result.data && result.data.checkins ? result.data.checkins : []);
    } catch (err) {
      setError("簽到名單載入失敗。");
    } finally {
      setLoading(false);
    }
  };

  const loadOrderPlans = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listOrderPlans" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const items = result.data && result.data.plans ? result.data.plans : [];
      const sorted = items.slice().sort((a, b) => String(b.date || "").localeCompare(a.date || ""));
      setOrderPlans(sorted);
    } catch (err) {
      setError("訂餐設定載入失敗。");
    } finally {
      setLoading(false);
    }
  };

  const loadOrderResponses = async (orderId) => {
    if (!orderId) {
      setOrderResponses([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listOrderResponses", orderId: orderId });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setOrderResponses(result.data && result.data.responses ? result.data.responses : []);
    } catch (err) {
      setError("訂餐名單載入失敗。");
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationEdit = (registration) => {
    setRegistrationForm({
      id: registration.id || "",
      status: registration.status || "registered",
    });
  };

  const handleRegistrationSubmit = async (event) => {
    event.preventDefault();
    const inputValue = String(registrationForm.id || "").trim();
    if (!inputValue) {
      setError("請先輸入報名 ID、學號或姓名。");
      return;
    }
    setSaving(true);
    setError("");
    setRegistrationStatusMessage("");
    try {
      let targetRegistration = null;
      if (inputValue.toUpperCase().startsWith("P")) {
        targetRegistration =
          registrations.find(
            (item) =>
              String(item.studentId || "").trim() === inputValue ||
              String(parseCustomFields_(item.customFields).studentId || "").trim() === inputValue
          ) || null;
      } else {
        const nameMatches = registrations.filter(
          (item) => normalizeName_(item.userName) === inputValue
        );
        if (nameMatches.length > 1) {
          throw new Error("找到多筆同名報名，請改用報名 ID 或學號。");
        }
        targetRegistration = nameMatches[0] || null;
      }
      if (!targetRegistration) {
        const directMatch = registrations.find(
          (item) => String(item.id || "").trim() === inputValue
        );
        targetRegistration = directMatch || null;
      }
      if (!targetRegistration) {
        throw new Error("找不到對應報名，請確認報名 ID/學號/姓名。");
      }

      const payload = {
        id: targetRegistration.id,
        status: registrationForm.status || "registered",
      };
      const { result } = await apiRequest({ action: "updateRegistration", data: payload });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      setRegistrationForm({ id: "", status: "registered" });
      await loadRegistrations();
      setRegistrationStatusMessage("已更新報名狀態");
    } catch (err) {
      setError(err.message || "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleOrderFormChange = (key, value) => {
    if ((key === "optionAImage" || key === "optionBImage") && String(value || "").startsWith("data:")) {
      setOrderStatusMessage("圖片請使用網址，請勿貼上 data: 圖片");
      return;
    }
    setOrderForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleOrderImageDrop = (key, event) => {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
      setOrderStatusMessage("請改用圖片網址，目前不支援直接拖檔上傳。");
      return;
    }
    const uri = event.dataTransfer.getData("text/uri-list");
    const text = event.dataTransfer.getData("text/plain");
    const value = String(uri || text || "").trim();
    if (value && value.startsWith("data:")) {
      setOrderStatusMessage("圖片請使用網址，請勿貼上 data: 圖片");
      return;
    }
    if (value) {
      setOrderForm((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleOrderDateChange = (value) => {
    const parsed = parseLocalInputDate_(value);
    setOrderForm((prev) => {
      const next = { ...prev, date: value };
      if (parsed) {
        next.cutoffAt = toLocalInput_(addDays_(parsed, -1), 23, 59);
        if (!prev.title || prev.title.startsWith("訂餐")) {
          next.title = `訂餐 ${value}`;
        }
      }
      return next;
    });
  };

  const handleOrderReset = () => {
    setOrderActiveId("");
    setOrderForm(buildDefaultOrderForm());
    setOrderResponses([]);
    setOrderStatusMessage("");
  };

  const handleOrderSave = async (event) => {
    event.preventDefault();
    if (!orderForm.date) {
      setOrderStatusMessage("請先選擇日期。");
      return;
    }
    if (
      String(orderForm.optionAImage || "").startsWith("data:") ||
      String(orderForm.optionBImage || "").startsWith("data:")
    ) {
      setOrderStatusMessage("圖片請使用網址，請勿貼上 data: 圖片");
      return;
    }
    setSaving(true);
    setError("");
    setOrderStatusMessage("");
    try {
      let result = null;
      if (orderForm.id) {
        const response = await apiRequest({
          action: "updateOrderPlan",
          id: orderForm.id,
          data: orderForm,
        });
        result = response.result;
      } else {
        const response = await apiRequest({
          action: "createOrderPlan",
          data: orderForm,
        });
        result = response.result;
      }
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      const plan = result.data && result.data.plan ? result.data.plan : null;
      await loadOrderPlans();
      if (plan && plan.id) {
        setOrderActiveId(normalizeOrderId_(plan.id));
      }
      setOrderStatusMessage("已更新訂餐設定");
    } catch (err) {
      setOrderStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const applyMembershipDraft_ = (payload) => {
    const personId = String(payload.personId || "").trim();
    const groupId = String(payload.groupId || "").trim();
    const roleInGroup = String(payload.roleInGroup || "").trim();
    if (!personId || !groupId || !roleInGroup) {
      return;
    }
    let blocked = false;
    setDraftMemberships((prev) => {
      if (
        groupId === "A" &&
        roleInGroup === "lead" &&
        prev.some(
          (item) =>
            String(item.groupId || "").trim() === "A" &&
            String(item.roleInGroup || "").trim() === "lead" &&
            String(item.personId || "").trim() !== personId
        )
      ) {
        blocked = true;
        return prev;
      }
      const next = prev.slice();
      const existingIndex = next.findIndex(
        (item) =>
          String(item.personId || "").trim() === personId &&
          String(item.groupId || "").trim() === groupId
      );
      if (existingIndex >= 0) {
        if (String(next[existingIndex].roleInGroup || "").trim() === roleInGroup) {
          return prev;
        }
        next.splice(existingIndex, 1);
      }
      next.push({
        id: payload.id || "",
        personId: personId,
        personName: payload.personName || "",
        groupId: groupId,
        roleInGroup: roleInGroup,
        notes: payload.notes || "",
      });
      return next;
    });
    if (blocked) {
      setError("班代組只能有一位班代");
      return;
    }
    setMembershipDirty(true);
    setMembershipStatus("尚未儲存");
    setError("");
  };

  const removeMembershipDraft_ = (membership) => {
    if (!membership) {
      return;
    }
    const targetKey = buildMembershipKey_(membership);
    setDraftMemberships((prev) =>
      prev.filter((item) => buildMembershipKey_(item) !== targetKey)
    );
    setMembershipDirty(true);
    setMembershipStatus("尚未儲存");
  };

  const parseDragPayload_ = (event) => {
    try {
      const raw = event.dataTransfer.getData("application/json");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  const handleDragStartStudent_ = (student, event) => {
    if (!student) {
      return;
    }
    const payload = {
      source: "student",
      personId: student.id || "",
      personName: getDisplayName_(student),
    };
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleDragStartMembership_ = (membership, event) => {
    if (!membership) {
      return;
    }
    const payload = {
      source: "membership",
      personId: membership.personId || "",
      personName: membership.personName || "",
      groupId: membership.groupId || "",
      roleInGroup: membership.roleInGroup || "",
    };
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDropToRole_ = (groupId, roleInGroup, event) => {
    event.preventDefault();
    const payload = parseDragPayload_(event);
    if (!payload || !payload.personId) {
      return;
    }
    applyMembershipDraft_({
      id: "",
      personId: payload.personId,
      personName: payload.personName,
      groupId,
      roleInGroup,
    });
  };

  const handleSelectMember_ = (student) => {
    if (!student) {
      setSelectedMember(null);
      return;
    }
    setSelectedMember({
      personId: student.id || "",
      personName: getDisplayName_(student) || "",
    });
  };

  const handleAssignSelectedMember_ = (groupId, roleInGroup) => {
    if (!selectedMember || !selectedMember.personId) {
      setError("請先從左側選擇同學");
      return;
    }
    applyMembershipDraft_({
      id: "",
      personId: selectedMember.personId,
      personName: selectedMember.personName,
      groupId,
      roleInGroup,
    });
  };

  const toggleExpandedGroup_ = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const expandAllGroups_ = (groups) => {
    setExpandedGroups(new Set(groups.map((group) => group.id)));
  };

  const collapseAllGroups_ = () => {
    setExpandedGroups(new Set());
  };

  const handleSaveMembershipDrafts_ = async () => {
    setSaving(true);
    setError("");
    setMembershipStatus("");
    setMembershipSaveError("");
    try {
      const originKeys = new Map();
      groupMemberships.forEach((item) => {
        originKeys.set(buildMembershipKey_(item), item);
      });
      const draftKeys = new Map();
      draftMemberships.forEach((item) => {
        draftKeys.set(buildMembershipKey_(item), item);
      });

      const toDelete = groupMemberships.filter(
        (item) => !draftKeys.has(buildMembershipKey_(item))
      );
      const toAdd = draftMemberships.filter(
        (item) => !originKeys.has(buildMembershipKey_(item))
      );

      const { result } = await apiRequest({
        action: "batchUpdateGroupMemberships",
        data: {
          toDeleteIds: toDelete.map((item) => item.id).filter(Boolean),
          toUpsert: toAdd.map((item) => ({
            id: item.id,
            personId: item.personId,
            personName: item.personName,
            groupId: item.groupId,
            roleInGroup: item.roleInGroup,
            notes: item.notes || "",
          })),
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }

      await loadGroupMemberships();
      setMembershipDirty(false);
      setMembershipStatus("已更新班務分組");
    } catch (err) {
      setError(err.message || "儲存失敗");
      setMembershipSaveError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleResetMembershipDrafts_ = () => {
    setDraftMemberships(groupMemberships);
    setMembershipDirty(false);
    setMembershipStatus("");
    setError("");
  };

  const handleRegistrationDelete = async (id) => {
    if (!id) {
      return;
    }
    if (!confirmDelete_("確定要刪除此筆報名資料嗎？此動作無法復原。")) {
      return;
    }
    setSaving(true);
    try {
      const { result } = await apiRequest({ action: "deleteRegistration", id: id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadRegistrations();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckinDelete = async (id) => {
    if (!id) {
      return;
    }
    if (!confirmDelete_("確定要刪除此筆簽到資料嗎？此動作無法復原。")) {
      return;
    }
    setSaving(true);
    try {
      const { result } = await apiRequest({ action: "deleteCheckin", id: id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadCheckins();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!eventId) {
      return;
    }
    const eventLabel =
      events.find((item) => String(item.id || "").trim() === String(eventId).trim())?.title ||
      eventId;
    if (!confirmDelete_(`確定要刪除活動「${eventLabel}」嗎？此動作無法復原。`)) {
      return;
    }
    setSaving(true);
    try {
      const { result } = await apiRequest({ action: "deleteEvent", eventId: eventId });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadEvents();
      if (activeId === eventId) {
        setActiveId("");
      }
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const action = activeId ? "updateEvent" : "createEvent";
      const { result } = await apiRequest({ action: action, data: form });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      if (result.data && result.data.event) {
        const updatedEvent = result.data.event;
        setEvents((prev) =>
          prev.map((item) => (item.id === updatedEvent.id ? { ...item, ...updatedEvent } : item))
        );
      }
      setActiveId("");
      setForm(buildDefaultForm(events));
      await loadEvents();
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => {
      if (field === "id" && !activeId) {
        const baseUrl = normalizeBaseUrl_(PUBLIC_SITE_URL) || window.location.origin;
        return {
          ...prev,
          id: value,
          registerUrl: value
            ? `${baseUrl}/register?eventId=${encodeURIComponent(value)}`
            : prev.registerUrl,
          checkinUrl: value
            ? `${baseUrl}/checkin?eventId=${encodeURIComponent(value)}`
            : prev.checkinUrl,
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleCopyCheckinUrl = async () => {
    const value = String(form.checkinUrl || "").trim();
    if (!value) {
      setCopyStatus("請先填寫簽到連結");
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyStatus("已複製簽到連結");
    } catch (err) {
      setCopyStatus("複製失敗");
    } finally {
      setTimeout(() => setCopyStatus(""), 1800);
    }
  };

  const handleCopyRegisterUrl = async () => {
    const value = String(form.registerUrl || "").trim();
    if (!value) {
      setRegisterCopyStatus("請先填寫報名連結");
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setRegisterCopyStatus("已複製報名連結");
    } catch (err) {
      setRegisterCopyStatus("複製失敗");
    } finally {
      setTimeout(() => setRegisterCopyStatus(""), 1800);
    }
  };

  const handleCategoryChange = (value) => {
    setForm((prev) => {
      const next = { ...prev, category: value };
      if (!activeId) {
        const fallbackDate = parseLocalInputDate_(prev.startAt) || addDays_(new Date(), 10);
        next.id = generateEventId_(fallbackDate, value, events, seedTimestamp);
        next.checkinUrl = `${baseUrl}/checkin?eventId=${encodeURIComponent(next.id)}`;
      }
      return next;
    });
  };

  const attachments = parseEventAttachments_(form.attachments);

  const handleAddAttachmentLink = () => {
    const url = String(attachmentUrlInput || "").trim();
    if (!url) {
      return;
    }
    const name = url.replace(/^https?:\/\//, "");
    setForm((prev) => {
      const current = parseEventAttachments_(prev.attachments);
      const next = current.concat([{ name: name, url: url, fileId: "" }]);
      return { ...prev, attachments: JSON.stringify(next) };
    });
    setAttachmentUrlInput("");
  };

  const handleRemoveAttachment = (index) => {
    setForm((prev) => {
      const current = parseEventAttachments_(prev.attachments);
      const next = current.filter((_, idx) => idx !== index);
      return { ...prev, attachments: JSON.stringify(next) };
    });
  };

  const handleUploadChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    if (!form.id) {
      setUploadError("請先儲存活動後再上傳");
      if (uploadFileRef.current) {
        uploadFileRef.current.value = "";
      }
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("檔案超過 5MB 上限");
      if (uploadFileRef.current) {
        uploadFileRef.current.value = "";
      }
      return;
    }
    if (!uploadFormRef.current) {
      setUploadError("上傳表單未初始化");
      return;
    }
    setUploading(true);
    setUploadError("");
    uploadCompletedRef.current = false;
    uploadFormRef.current.submit();
  };

  const handleStartAtChange = (value) => {
    const startDate = parseLocalInputDate_(value);
    if (!startDate) {
      handleChange("startAt", value);
      return;
    }
    const endDate = addMinutes_(startDate, 120);
    const checkinOpen = addMinutes_(startDate, -30);
    const checkinClose = addMinutes_(startDate, 90);
    setForm((prev) => {
      const next = {
        ...prev,
        startAt: value,
        endAt: toLocalInputValue_(endDate),
        checkinOpenAt: toLocalInputValue_(checkinOpen),
        checkinCloseAt: toLocalInputValue_(checkinClose),
      };
      if (!activeId) {
        next.id = generateEventId_(startDate, prev.category, events, seedTimestamp);
        const baseUrl = normalizeBaseUrl_(PUBLIC_SITE_URL) || window.location.origin;
        next.registerUrl = `${baseUrl}/register?eventId=${encodeURIComponent(next.id)}`;
        next.checkinUrl = `${window.location.origin}/checkin?eventId=${encodeURIComponent(next.id)}`;
      }
      return next;
    });
  };

  const handleRegistrationOpenChange = (value) => {
    const openDate = parseLocalInputDate_(value);
    if (!openDate) {
      handleChange("registrationOpenAt", value);
      return;
    }
    const closeDate = addDays_(openDate, 12);
    setForm((prev) => ({
      ...prev,
      registrationOpenAt: value,
      registrationCloseAt: toLocalInputValue_(closeDate),
    }));
  };

  const handleResetDefaults = () => {
    setSeedTimestamp(Date.now());
    setForm(buildDefaultForm(events));
  };

  const registrationsByEvent = registrations.reduce((acc, registration) => {
    const eventId = normalizeEventId_(registration.eventId);
    if (!eventId) {
      return acc;
    }
    if (!acc[eventId]) {
      acc[eventId] = [];
    }
    acc[eventId].push(registration);
    return acc;
  }, {});

  const checkinsByEvent = checkins.reduce((acc, checkin) => {
    const eventId = normalizeEventId_(checkin.eventId);
    if (!eventId) {
      return acc;
    }
    if (!acc[eventId]) {
      acc[eventId] = [];
    }
    acc[eventId].push(checkin);
    return acc;
  }, {});

  const registrationList = registrationEventId
    ? registrationsByEvent[normalizeEventId_(registrationEventId)] || []
    : registrations;
  const attendanceByStudentId = new Map();
  const attendanceByName = new Map();
  registrationList.forEach((registration) => {
    const fields = parseCustomFields_(registration.customFields);
    const attendanceValue = String(fields.attendance || "").trim();
    const studentId = String(registration.studentId || "").trim();
    if (studentId) {
      attendanceByStudentId.set(studentId, attendanceValue);
    }
    const nameKey = normalizeName_(registration.userName);
    if (nameKey) {
      attendanceByName.set(nameKey, attendanceValue);
    }
  });
  const registeredStudentIdSet = new Set(
    registrationList
      .map((item) => {
        const fields = parseCustomFields_(item.customFields);
        return String(item.studentId || fields.studentId || "").trim();
      })
      .filter((value) => value)
  );
  const registeredNameSet = new Set(
    registrationList
      .map((item) => normalizeName_(item.userName))
      .filter((value) => value)
  );

  const displayStudents = directory.length ? directory : students;
  const totalStudents = displayStudents.length;
  const registeredCount =
    registeredStudentIdSet.size || registeredNameSet.size ? registrationList.length : 0;
  const unregisteredCount = totalStudents
    ? Math.max(totalStudents - registeredCount, 0)
    : 0;
  const attendanceCounts = registrationList.reduce(
    (acc, registration) => {
      const fields = parseCustomFields_(registration.customFields);
      const attendanceValue = String(fields.attendance || "").trim();
      if (attendanceValue === "出席") {
        acc.attending += 1;
      } else if (attendanceValue === "不克出席") {
        acc.notAttending += 1;
      } else if (
        attendanceValue === "尚未確定" ||
        attendanceValue === "未定" ||
        attendanceValue === "未確認" ||
        !attendanceValue
      ) {
        acc.unknown += 1;
      } else {
        acc.unknown += 1;
      }
      return acc;
    },
    { attending: 0, notAttending: 0, unknown: 0 }
  );

  const filteredStudents = displayStudents.filter((item) =>
    matchesStudentQuery_(item, studentsQuery)
  );
  const filteredStudentsForRegistrations = displayStudents.filter((item) =>
    matchesStudentQuery_(item, unregisteredQuery)
  );

  const checkinList = checkinEventId
    ? checkinsByEvent[normalizeEventId_(checkinEventId)] || []
    : checkins;
  const checkinRegistrationSet = new Set(
    checkinList.map((item) => String(item.registrationId || "").trim())
  );
  const checkinStatusByRegistrationId = checkinList.reduce((acc, item) => {
    const registrationId = String(item.registrationId || "").trim();
    if (registrationId) {
      acc[registrationId] = item;
    }
    return acc;
  }, {});

  const orderStats = orderResponses.reduce(
    (acc, item) => {
      const choice = String(item.choice || "").toUpperCase();
      if (choice === "A") {
        acc.A += 1;
      } else if (choice === "B") {
        acc.B += 1;
      } else {
        acc.NONE += 1;
      }
      acc.total += 1;
      return acc;
    },
    { A: 0, B: 0, NONE: 0, total: 0 }
  );

  const orderComments = orderResponses
    .map((item) => String(item.comment || "").trim())
    .filter((value) => value);

  const pendingCheckins = checkinEventId
    ? (registrationsByEvent[normalizeEventId_(checkinEventId)] || []).filter((registration) => {
        if (!registration || String(registration.status || "").toLowerCase() === "cancelled") {
          return false;
        }
        const attendance = String(parseCustomFields_(registration.customFields).attendance || "")
          .trim();
        if (attendance && attendance !== "出席") {
          return false;
        }
        const registrationId = String(registration.id || "").trim();
        return registrationId && !checkinRegistrationSet.has(registrationId);
      })
    : [];

  const draftMembershipsByPerson = draftMemberships.reduce((acc, item) => {
    const personId = String(item.personId || "").trim();
    if (!personId) {
      return acc;
    }
    if (!acc[personId]) {
      acc[personId] = [];
    }
    acc[personId].push(item);
    return acc;
  }, {});

  const rolesQuery = String(membershipQuery || "").trim().toLowerCase();
  const sortedStudentsForRoles = students
    .filter((item) => {
      if (!rolesQuery) {
        return true;
      }
      const haystack = [
        item.id,
        item.email,
        item.googleEmail,
        item.name,
        item.nameZh,
        item.nameEn,
        item.preferredName,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(rolesQuery);
    })
    .slice()
    .sort((a, b) => {
      const aId = String(a.id || "").trim();
      const bId = String(b.id || "").trim();
      const aAssigned = Boolean(draftMembershipsByPerson[aId]);
      const bAssigned = Boolean(draftMembershipsByPerson[bId]);
      if (aAssigned !== bAssigned) {
        return aAssigned ? 1 : -1;
      }
      const aName = normalizeName_(getDisplayName_(a));
      const bName = normalizeName_(getDisplayName_(b));
      if (aName !== bName) {
        return aName.localeCompare(bName, "zh-Hant");
      }
      return aId.localeCompare(bId);
    });

  const groupCards = CLASS_GROUPS.filter((group) => group.id !== "A");
  const orderedGroupCards = pinnedGroupId
    ? groupCards
        .slice()
        .sort((a, b) => (a.id === pinnedGroupId ? -1 : b.id === pinnedGroupId ? 1 : 0))
    : groupCards;
  const visibleStudentsForRoles = showOnlyUnassigned
    ? sortedStudentsForRoles.filter(
        (student) => !draftMembershipsByPerson[normalizePersonId_(student.id)]
      )
    : sortedStudentsForRoles;

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              後台管理 (MVP)
            </h1>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <a
              href="/"
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm hover:border-slate-300"
            >
              回首頁
            </a>
            <span className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm">
              管理者模式
            </span>
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-5xl flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 sm:hidden">
          <a
            href="/"
            className="btn-chip px-3 py-1.5"
          >
            回首頁
          </a>
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-slate-500 shadow-sm">
            管理者模式
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 pb-28 pt-10 sm:px-12">
        <section className="card p-4 sm:p-6">
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
            {[
              { id: "events", label: "活動" },
              { id: "ordering", label: "訂餐" },
              { id: "registrations", label: "報名" },
              { id: "checkins", label: "簽到" },
              { id: "students", label: "同學" },
              { id: "roles", label: "班務分組" },
            ]
              .filter((item) => allowedTabs.includes(item.id))
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  disabled={isMembershipSaving}
                  className={`rounded-xl px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    activeTab === item.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
          </div>
        </section>

        <section className="card p-7 sm:p-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {activeTab === "events"
                ? "活動列表"
                : activeTab === "ordering"
                ? "訂餐管理"
                : activeTab === "registrations"
                ? "報名名單"
                : activeTab === "checkins"
                ? "簽到名單"
                : "同學名單"}
            </h2>
            {loading ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                載入中
              </span>
            ) : null}
          </div>
          {error ? (
            <div className="mt-4 alert alert-warning">
              {error}
            </div>
          ) : null}
          {activeTab === "events" ? (
            <div className="mt-6 space-y-4">
              {sortedEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {event.title}
                      {isEventClosed_(event) ? " (已結束)" : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDisplayDate_(event.startAt, { withTime: true }) || "-"} ·{" "}
                      {event.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEdit(event)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      disabled={saving}
                      className="badge-error hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "ordering" ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">訂餐日期</h3>
                    <button
                      onClick={handleOrderReset}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      新增
                    </button>
                  </div>
                  <div className="space-y-2">
                    {orderPlans.length ? (
                      orderPlans.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => setOrderActiveId(normalizeOrderId_(plan.id))}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            normalizeOrderId_(orderActiveId) === normalizeOrderId_(plan.id)
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{formatOrderDateLabel_(plan.date)}</p>
                            <p className="text-xs opacity-70">
                              {plan.title || "訂餐"} · {plan.status || "open"}
                            </p>
                          </div>
                          <span className="text-xs opacity-70">{plan.id}</span>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">尚未建立訂餐日期。</p>
                    )}
                  </div>
                </div>

                <form onSubmit={handleOrderSave} className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">日期</label>
                    <input
                      type="date"
                      value={orderForm.date}
                      onChange={(event) => handleOrderDateChange(event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">標題</label>
                    <input
                      value={orderForm.title}
                      onChange={(event) => handleOrderFormChange("title", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">選項 A</label>
                      <input
                        value={orderForm.optionA}
                        onChange={(event) => handleOrderFormChange("optionA", event.target.value)}
                        className="input-sm"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">選項 B</label>
                      <input
                        value={orderForm.optionB}
                        onChange={(event) => handleOrderFormChange("optionB", event.target.value)}
                        className="input-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div
                      className="grid gap-2"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleOrderImageDrop("optionAImage", event)}
                    >
                      <label className="text-sm font-medium text-slate-700">A 餐圖片</label>
                      <input
                        value={orderForm.optionAImage}
                        onChange={(event) =>
                          handleOrderFormChange("optionAImage", event.target.value)
                        }
                        placeholder="貼上圖片網址或拖曳圖片"
                        className="input-sm"
                      />
                      <p className="text-xs text-slate-400">請貼上圖片網址（https://...）</p>
                      {orderForm.optionAImage ? (
                        <img
                          src={orderForm.optionAImage}
                          alt="A 餐"
                          className="h-28 w-full rounded-2xl border border-slate-200 object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div
                      className="grid gap-2"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleOrderImageDrop("optionBImage", event)}
                    >
                      <label className="text-sm font-medium text-slate-700">B 餐圖片</label>
                      <input
                        value={orderForm.optionBImage}
                        onChange={(event) =>
                          handleOrderFormChange("optionBImage", event.target.value)
                        }
                        placeholder="貼上圖片網址或拖曳圖片"
                        className="input-sm"
                      />
                      <p className="text-xs text-slate-400">請貼上圖片網址（https://...）</p>
                      {orderForm.optionBImage ? (
                        <img
                          src={orderForm.optionBImage}
                          alt="B 餐"
                          className="h-28 w-full rounded-2xl border border-slate-200 object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">截止時間</label>
                      <input
                        type="datetime-local"
                        value={orderForm.cutoffAt}
                        onChange={(event) => handleOrderFormChange("cutoffAt", event.target.value)}
                        className="input-sm"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">狀態</label>
                      <select
                        value={orderForm.status}
                        onChange={(event) => handleOrderFormChange("status", event.target.value)}
                        className="input-sm"
                      >
                        <option value="open">開放</option>
                        <option value="closed">關閉</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">備註</label>
                    <textarea
                      value={orderForm.notes}
                      onChange={(event) => handleOrderFormChange("notes", event.target.value)}
                      rows="3"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary"
                    >
                      {saving ? "儲存中..." : orderForm.id ? "更新訂餐" : "新增訂餐"}
                    </button>
                    {orderStatusMessage ? (
                      <span className="text-xs font-semibold text-amber-600">
                        {orderStatusMessage}
                      </span>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="card-muted p-5 text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">訂餐統計</p>
                  <span className="text-xs text-slate-400">
                    {orderActiveId ? `訂餐編號 ${orderActiveId}` : "尚未選擇訂餐日期"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-400">總數</p>
                    <p className="text-lg font-semibold text-slate-900">{orderStats.total}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-400">A 餐</p>
                    <p className="text-lg font-semibold text-slate-900">{orderStats.A}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-400">B 餐</p>
                    <p className="text-lg font-semibold text-slate-900">{orderStats.B}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-400">不吃</p>
                    <p className="text-lg font-semibold text-slate-900">{orderStats.NONE}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-600">訂餐名單</p>
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      {orderResponses.length ? (
                        orderResponses.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2"
                          >
                            <span
                              className="font-semibold text-slate-800"
                              title={item.studentId ? `學號 ${item.studentId}` : ""}
                            >
                              {item.studentName || "未命名"}
                            </span>
                            <span className="text-xs text-slate-500">{item.choice}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">目前尚無訂餐資料。</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-600">匿名意見</p>
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      {orderComments.length ? (
                        orderComments.map((comment, index) => (
                          <div
                            key={`${comment}-${index}`}
                            className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2"
                          >
                            {comment}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">目前沒有留言。</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "registrations" ? (
            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
                <div className="grid gap-2 text-sm">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    選擇活動
                  </label>
                  <select
                    value={registrationEventId}
                    onChange={(event) => setRegistrationEventId(event.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    {sortedEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                        {isEventClosed_(event) ? " (已結束)" : ""} · {event.id}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="badge-success">
                      已報名 {registeredCount}
                    </span>
                    <span className="btn-chip">
                      未報名 {unregisteredCount}
                    </span>
                    <span className="badge-success">
                      出席 {attendanceCounts.attending}
                    </span>
                    <span className="badge-error">
                      不克出席 {attendanceCounts.notAttending}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-slate-600">
                      未定 {attendanceCounts.unknown}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                      總數 {totalStudents}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>報名狀態</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    色塊提示報名狀態：綠色＝出席，紅色＝不克出席，灰色＝未定，白色＝未報名。
                  </p>
                  <input
                    value={unregisteredQuery}
                    onChange={(event) => setUnregisteredQuery(event.target.value)}
                    placeholder="搜尋姓名、Email、學號..."
                    className="h-9 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400"
                  />
                </div>
                {filteredStudentsForRegistrations.length ? (
                  <div className="flex flex-wrap gap-2">
                    {filteredStudentsForRegistrations.map((student) => {
                      const studentId = String(student.id || "").trim();
                      const displayName = getDisplayName_(student);
                      const normalizedName = normalizeName_(displayName);
                      const isRegistered =
                        (studentId && registeredStudentIdSet.has(studentId)) ||
                        (normalizedName && registeredNameSet.has(normalizedName));
                      const attendanceValue =
                        (studentId && attendanceByStudentId.get(studentId)) ||
                        (normalizedName && attendanceByName.get(normalizedName)) ||
                        "";
                      const hoverTitle = [
                        studentId ? `學號 ${studentId}` : "",
                        student.googleEmail || student.email || "",
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      const attendanceStatus =
                        attendanceValue === "不克出席"
                          ? "not_attending"
                          : attendanceValue === "尚未確定" ||
                            attendanceValue === "未定" ||
                            attendanceValue === "未確認"
                          ? "unknown"
                          : attendanceValue === "出席"
                          ? "attending"
                          : "";
                      const badgeStyle = isRegistered
                        ? attendanceStatus === "not_attending"
                          ? "badge-error"
                          : attendanceStatus === "unknown"
                          ? "border-slate-300 bg-slate-100 text-slate-600"
                          : "badge-success"
                        : "border-slate-200 bg-white text-slate-400";
                      return (
                        <span
                          key={student.id || student.googleEmail || student.email}
                          title={hoverTitle}
                          className={`inline-flex items-center gap-2 tabular-nums ${badgeStyle}`}
                        >
                          {displayName || "未命名"}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">目前沒有資料。</p>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "checkins" ? (
            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
                <div className="grid gap-2 text-sm">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    選擇活動
                  </label>
                  <select
                    value={checkinEventId}
                    onChange={(event) => setCheckinEventId(event.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    {sortedEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                        {isEventClosed_(event) ? " (已結束)" : ""} · {event.id}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="badge-success">
                      已簽到 {checkinList.length}
                    </span>
                    <span className="badge-warning">
                      未簽到 {pendingCheckins.length}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                      總數 {checkinList.length + pendingCheckins.length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>簽到狀態</span>
                </div>
                <p className="text-xs text-slate-500">
                  色塊提示簽到狀態：綠色＝已簽到，琥珀＝未簽到。
                </p>
                {registrationList.length ? (
                  <div className="flex flex-wrap gap-2">
                    {registrationList.map((registration) => {
                      const registrationId = String(registration.id || "").trim();
                      const checkin = checkinStatusByRegistrationId[registrationId] || null;
                      const studentId = registration.studentId;
                      const hoverTitle = [
                        studentId ? `學號 ${studentId}` : "",
                        checkin && checkin.checkinAt ? checkin.checkinAt : "",
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <span
                          key={registrationId || registration.userEmail}
                          title={hoverTitle}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${
                            checkin
                              ? "badge-success"
                              : "badge-warning"
                          }`}
                        >
                          {registration.userName || "未命名"}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">目前沒有資料。</p>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "students" ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">共 {filteredStudents.length} 筆</p>
                <input
                  value={studentsQuery}
                  onChange={(event) => setStudentsQuery(event.target.value)}
                  placeholder="搜尋姓名、Email、學號..."
                  className="h-9 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              {filteredStudents.map((item) => (
                <div
                  key={item.id || item.googleEmail}
                  className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {getDisplayName_(item) || "未命名"}
                      </p>
                      <p className="text-xs text-slate-500">
                        <span className="tabular-nums">{item.id || "-"}</span> · {item.googleEmail || item.email || "-"}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.nameEn ? `EN: ${item.nameEn}` : item.googleSub || "-"}
                    </div>
                  </div>
                  {item.company ||
                  item.title ||
                  item.dietaryRestrictions ||
                  item.preferredName ||
                  item.nameEn ? (
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      <div>稱呼: {item.preferredName || "-"}</div>
                      <div>英文姓名: {item.nameEn || "-"}</div>
                      <div>公司: {item.company || "-"}</div>
                      <div>職稱: {item.title || "-"}</div>
                      <div>飲食禁忌: {item.dietaryRestrictions || "-"}</div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "roles" ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-600">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">班務分組名單</p>
                    <span className="text-xs text-slate-400">拖拉或點選加入右側</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={membershipQuery}
                      onChange={(event) => setMembershipQuery(event.target.value)}
                      placeholder="搜尋姓名、學號、Email..."
                      className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOnlyUnassigned((prev) => !prev)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        showOnlyUnassigned
                          ? "badge-error"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {showOnlyUnassigned ? "只看未分派" : "全部名單"}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                    <span
                      className={`rounded-full border px-3 py-1 ${ROLE_BADGE_STYLES.rep}`}
                    >
                      班代
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 ${ROLE_BADGE_STYLES.repDeputy}`}
                    >
                      副班代
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 ${ROLE_BADGE_STYLES.lead}`}
                    >
                      組長
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 ${ROLE_BADGE_STYLES.deputy}`}
                    >
                      副組長
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 ${ROLE_BADGE_STYLES.member}`}
                    >
                      成員
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 ${ROLE_BADGE_STYLES.unassigned}`}
                    >
                      未分派
                    </span>
                  </div>
                  <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                    {visibleStudentsForRoles.length ? (
                      visibleStudentsForRoles.map((student) => {
                        const personId = String(student.id || "").trim();
                        const memberships = draftMembershipsByPerson[personId] || [];
                        const displayName = getDisplayName_(student) || "未命名";
                        const isSelected =
                          selectedMember &&
                          normalizePersonId_(selectedMember.personId) === normalizePersonId_(student.id);
                        const badgeItems = memberships.length
                          ? memberships.map((item) => ({
                              label: getGroupLabel_(item.groupId),
                              styleKey: getMembershipRoleStyleKey_(item),
                              key: buildMembershipKey_(item),
                            }))
                          : [
                              {
                                label: "未分派",
                                styleKey: "unassigned",
                                key: `${personId}-unassigned`,
                              },
                            ];
                        return (
                          <button
                            key={student.id || student.googleEmail || student.email || displayName}
                            type="button"
                            draggable
                            onDragStart={(event) => handleDragStartStudent_(student, event)}
                            onClick={() => handleSelectMember_(student)}
                            className={`group flex w-full cursor-pointer flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-semibold shadow-sm ${
                              isSelected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span
                              className="whitespace-nowrap"
                              title={student.id ? `學號 ${student.id}` : ""}
                            >
                              {displayName}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {badgeItems.map((badge) => (
                                <span
                                  key={badge.key}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                                    isSelected ? "border-white/30 bg-white/10 text-white" : ROLE_BADGE_STYLES[badge.styleKey]
                                  }`}
                                >
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400">尚未載入同學名單。</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-600">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">班務分組維護</p>
                      <p className="mt-1 text-xs text-slate-500">
                        點選左側同學後，點右側區塊即可加入；拖拉也可使用。右側名單雙擊可移除，最後按「儲存變更」。
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedMember ? (
                        <span className="badge">
                          已選：{selectedMember.personName || selectedMember.personId}
                        </span>
                      ) : null}
                      {selectedMember ? (
                        <button
                          type="button"
                          onClick={() => handleSelectMember_(null)}
                          className="btn-chip"
                        >
                          取消選取
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleResetMembershipDrafts_}
                        disabled={!membershipDirty || saving}
                        className="btn-chip disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        還原
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveMembershipDrafts_}
                        disabled={!membershipDirty || saving}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? "儲存中..." : "儲存變更"}
                      </button>
                    </div>
                  </div>
                  {membershipStatus ? (
                    <p className="mt-2 text-xs font-semibold text-emerald-600">
                      {membershipStatus}
                    </p>
                  ) : null}
                  {isMembershipSaving ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs font-semibold text-slate-600">
                        正在寫入班務分組，請勿關閉或離開。
                      </p>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                        <div className="h-full w-2/3 animate-pulse rounded-full bg-slate-900/70" />
                      </div>
                    </div>
                  ) : null}
                  {membershipSaveError ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-rose-600">
                      <span>儲存失敗：{membershipSaveError}</span>
                      <button
                        type="button"
                        onClick={handleSaveMembershipDrafts_}
                        disabled={saving}
                        className="badge-error text-[11px] font-semibold hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        重試
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
                  <p className="text-sm font-semibold text-slate-700">班代 / 副班代</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      { title: "班代", roleInGroup: "lead", styleKey: "rep" },
                      { title: "副班代", roleInGroup: "deputy", styleKey: "repDeputy" },
                    ].map((role) => {
                      const items = draftMemberships
                        .filter(
                          (item) =>
                            String(item.groupId || "").trim() === "A" &&
                            String(item.roleInGroup || "").trim() === role.roleInGroup
                        )
                        .slice()
                        .sort((a, b) =>
                          normalizeName_(a.personName || "").localeCompare(
                            normalizeName_(b.personName || ""),
                            "zh-Hant"
                          )
                        );
                      return (
                        <div
                          key={role.title}
                          onClick={() => handleAssignSelectedMember_("A", role.roleInGroup)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleDropToRole_("A", role.roleInGroup, event)}
                          className="min-h-[88px] cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white/80 p-3"
                        >
                          <p className="text-xs font-semibold text-slate-500">{role.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {items.length ? (
                              items.map((item) => (
                                <div
                                  key={buildMembershipKey_(item)}
                                  draggable
                                  onDragStart={(event) => handleDragStartMembership_(item, event)}
                                  onDoubleClick={() => removeMembershipDraft_(item)}
                                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${ROLE_BADGE_STYLES[role.styleKey]}`}
                                  title="雙擊移除"
                                >
                                  <span title={item.personId ? `學號 ${item.personId}` : ""}>
                                    {item.personName || item.personId || "未命名"}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400">拖拉加入</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>組別設定</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => expandAllGroups_(groupCards)}
                        className="btn-chip"
                      >
                        全部展開
                      </button>
                      <button
                        type="button"
                        onClick={collapseAllGroups_}
                        className="btn-chip"
                      >
                        全部收合
                      </button>
                    </div>
                  </div>
                  {orderedGroupCards.map((group) => {
                    const leadItems = draftMemberships.filter(
                      (item) =>
                        String(item.groupId || "").trim() === group.id &&
                        String(item.roleInGroup || "").trim() === "lead"
                    );
                    const deputyItems = draftMemberships.filter(
                      (item) =>
                        String(item.groupId || "").trim() === group.id &&
                        String(item.roleInGroup || "").trim() === "deputy"
                    );
                    const memberItems = draftMemberships.filter(
                      (item) =>
                        String(item.groupId || "").trim() === group.id &&
                        String(item.roleInGroup || "").trim() === "member"
                    );
                    const isExpanded = expandedGroups.has(group.id);
                    const sortMembers = (items) =>
                      items
                        .slice()
                        .sort((a, b) =>
                          normalizeName_(a.personName || "").localeCompare(
                            normalizeName_(b.personName || ""),
                            "zh-Hant"
                          )
                        );
                    return (
                      <div
                        key={group.id}
                        className="rounded-2xl border border-slate-200/70 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandedGroup_(group.id)}
                            className="flex flex-1 flex-wrap items-center gap-2 text-left"
                          >
                            <p className="text-sm font-semibold text-slate-700">
                              {group.label}
                            </p>
                            <span className="text-xs text-slate-400">
                              組長 {leadItems.length} · 副組長 {deputyItems.length} · 成員{" "}
                              {memberItems.length} {isExpanded ? "· 收合" : "· 展開"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPinnedGroupId((prev) => (prev === group.id ? "" : group.id))
                            }
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              pinnedGroupId === group.id
                                ? "badge-warning"
                                : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            {pinnedGroupId === group.id ? "已置頂" : "置頂"}
                          </button>
                        </div>
                        {isExpanded ? (
                          <div className="mt-3 space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              {[
                                { title: "組長", roleInGroup: "lead", styleKey: "lead", items: leadItems },
                                {
                                  title: "副組長",
                                  roleInGroup: "deputy",
                                  styleKey: "deputy",
                                  items: deputyItems,
                                },
                              ].map((role) => (
                                <div
                                  key={`${group.id}-${role.roleInGroup}`}
                                  onClick={() => handleAssignSelectedMember_(group.id, role.roleInGroup)}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) =>
                                    handleDropToRole_(group.id, role.roleInGroup, event)
                                  }
                                  className="min-h-[96px] cursor-pointer rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-3"
                                >
                                  <p className="text-xs font-semibold text-slate-500">{role.title}</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {role.items.length ? (
                                      sortMembers(role.items).map((item) => (
                                        <div
                                          key={buildMembershipKey_(item)}
                                          draggable
                                          onDragStart={(event) => handleDragStartMembership_(item, event)}
                                          onDoubleClick={() => removeMembershipDraft_(item)}
                                          className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${ROLE_BADGE_STYLES[role.styleKey]}`}
                                          title="雙擊移除"
                                        >
                                          <span title={item.personId ? `學號 ${item.personId}` : ""}>
                                            {item.personName || item.personId || "未命名"}
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-xs text-slate-400">拖拉加入</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div
                              onClick={() => handleAssignSelectedMember_(group.id, "member")}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => handleDropToRole_(group.id, "member", event)}
                              className="min-h-[96px] cursor-pointer rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-3"
                            >
                              <p className="text-xs font-semibold text-slate-500">成員</p>
                              <div className="mt-2 columns-2 gap-2 md:columns-4 lg:columns-5">
                                {memberItems.length ? (
                                  sortMembers(memberItems).map((item) => (
                                    <div
                                      key={buildMembershipKey_(item)}
                                      draggable
                                      onDragStart={(event) => handleDragStartMembership_(item, event)}
                                      onDoubleClick={() => removeMembershipDraft_(item)}
                                      className={`mb-2 break-inside-avoid cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${ROLE_BADGE_STYLES.member}`}
                                      title="雙擊移除"
                                    >
                                      <span title={item.personId ? `學號 ${item.personId}` : ""}>
                                        {item.personName || item.personId || "未命名"}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-slate-400">拖拉加入</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

        </section>

        {activeTab === "events" ? (
          <section className="card p-7 sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">
              {activeId ? "編輯活動" : "新增活動"}
            </h2>
            <form
              ref={uploadFormRef}
              action={API_URL}
              method="post"
              encType="multipart/form-data"
              target="upload-frame"
              className="hidden"
            >
              <input type="hidden" name="eventId" value={form.id} />
              <input
                ref={uploadFileRef}
                id="event-upload-file"
                type="file"
                name="file"
                onChange={handleUploadChange}
              />
            </form>
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">活動類別</label>
              <select
                value={form.category}
                onChange={(event) => handleCategoryChange(event.target.value)}
                className="input-sm"
              >
                {EVENT_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">活動 ID</label>
              <input
                value={form.id}
                readOnly
                className="h-11 cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm text-slate-700 shadow-sm outline-none"
              />
              <p className="text-xs text-slate-400">
                系統自動產生，格式為 YYMMDDNN。
              </p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">活動名稱</label>
              <input
                value={form.title}
                onChange={(event) => handleChange("title", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">活動描述</label>
              <textarea
                value={form.description}
                onChange={(event) => handleChange("description", event.target.value)}
                rows="3"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-3 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">參考檔案</label>
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  value={attachmentUrlInput}
                  onChange={(event) => setAttachmentUrlInput(event.target.value)}
                  placeholder="貼上檔案分享連結"
                  className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAddAttachmentLink}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:border-slate-300"
                >
                  加入連結
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="event-upload-file"
                  className="inline-flex h-11 cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:border-slate-300"
                >
                  上傳檔案
                </label>
                {uploading ? <span className="text-xs text-slate-500">上傳中...</span> : null}
                {uploadError ? <span className="text-xs text-rose-600">{uploadError}</span> : null}
              </div>
              {attachments.length ? (
                <div className="space-y-2">
                  {attachments.map((item, index) => (
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
                        className="text-xs font-semibold text-rose-600"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">尚未加入任何參考檔案。</p>
              )}
              <iframe name="upload-frame" title="upload-frame" className="hidden" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">開始時間</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(event) => handleStartAtChange(event.target.value)}
                placeholder="2024-10-18 18:30"
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">結束時間</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(event) => handleChange("endAt", event.target.value)}
                placeholder="2024-10-18 21:30"
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">地點</label>
              <input
                value={form.location}
                onChange={(event) => handleChange("location", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">地址</label>
              <input
                value={form.address}
                onChange={(event) => handleChange("address", event.target.value)}
                className="input-sm"
              />
              {form.address ? (
                <a
                  href={buildGoogleMapsUrl_(form.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  開啟 Google 地圖
                </a>
              ) : null}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">名額</label>
              <input
                value={form.capacity}
                onChange={(event) => handleChange("capacity", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">可攜伴</label>
              <select
                value={form.allowCompanions}
                onChange={(event) => handleChange("allowCompanions", event.target.value)}
                className="input-sm"
              >
                <option value="yes">可以</option>
                <option value="no">不可以</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">可自帶酒水</label>
              <select
                value={form.allowBringDrinks}
                onChange={(event) => handleChange("allowBringDrinks", event.target.value)}
                className="input-sm"
              >
                <option value="yes">可以</option>
                <option value="no">不可以</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">報名開始</label>
              <input
                type="datetime-local"
                value={form.registrationOpenAt}
                onChange={(event) => handleRegistrationOpenChange(event.target.value)}
                placeholder="2024-09-20 09:00"
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">報名截止</label>
              <input
                type="datetime-local"
                value={form.registrationCloseAt}
                onChange={(event) => handleChange("registrationCloseAt", event.target.value)}
                placeholder="2024-10-10 23:00"
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">簽到開始</label>
              <input
                type="datetime-local"
                value={form.checkinOpenAt}
                onChange={(event) => handleChange("checkinOpenAt", event.target.value)}
                placeholder="2024-10-18 18:00"
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">簽到截止</label>
              <input
                type="datetime-local"
                value={form.checkinCloseAt}
                onChange={(event) => handleChange("checkinCloseAt", event.target.value)}
                placeholder="2024-10-18 20:30"
                className="input-sm"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">報名連結</label>
                <input
                  value={form.registerUrl}
                  onChange={(event) => handleChange("registerUrl", event.target.value)}
                  placeholder="https://your-domain/register?eventId=24011801"
                  className="input-sm"
                />
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                <button
                  type="button"
                  onClick={() =>
                    handleChange(
                      "registerUrl",
                      `${window.location.origin}/register?eventId=${encodeURIComponent(form.id || "")}`
                    )
                  }
                  className="btn-chip"
                >
                  使用目前網域產生
                </button>
                {PUBLIC_SITE_URL ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleChange(
                        "registerUrl",
                        `${normalizeBaseUrl_(PUBLIC_SITE_URL)}/register?eventId=${encodeURIComponent(
                          form.id || ""
                        )}`
                      )
                    }
                    className="btn-chip"
                  >
                    使用正式網域產生
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleCopyRegisterUrl}
                  className="btn-chip"
                >
                  複製報名連結
                </button>
                {form.registerUrl ? (
                  <a
                    href={form.registerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-slate-700"
                  >
                    開啟報名連結
                  </a>
                ) : null}
                {registerCopyStatus ? (
                  <span className="text-slate-400">{registerCopyStatus}</span>
                ) : null}
              </div>
              {form.registerUrl ? (
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <img
                    alt="Register QR Code"
                    className="h-24 w-24 rounded-2xl border border-slate-200 bg-white p-1"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(
                      form.registerUrl
                    )}`}
                  />
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
                      form.registerUrl
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    開啟 QRCode 圖檔
                  </a>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">簽到連結</label>
                <input
                  value={form.checkinUrl}
                  onChange={(event) => handleChange("checkinUrl", event.target.value)}
                  placeholder="https://your-domain/checkin?eventId=24011801"
                  className="input-sm"
                />
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                <button
                  type="button"
                  onClick={() =>
                    handleChange(
                      "checkinUrl",
                      `${window.location.origin}/checkin?eventId=${encodeURIComponent(form.id || "")}`
                    )
                  }
                  className="btn-chip"
                >
                  使用目前網域產生
                </button>
                {PUBLIC_SITE_URL ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleChange(
                        "checkinUrl",
                        `${normalizeBaseUrl_(PUBLIC_SITE_URL)}/checkin?eventId=${encodeURIComponent(
                          form.id || ""
                        )}`
                      )
                    }
                    className="btn-chip"
                  >
                    使用正式網域產生
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleCopyCheckinUrl}
                  className="btn-chip"
                >
                  複製簽到連結
                </button>
                {form.checkinUrl ? (
                  <a
                    href={form.checkinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-slate-700"
                  >
                    開啟簽到連結
                  </a>
                ) : null}
                {copyStatus ? <span className="text-slate-400">{copyStatus}</span> : null}
              </div>
              {form.checkinUrl ? (
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <img
                    alt="Check-in QR Code"
                    className="h-24 w-24 rounded-2xl border border-slate-200 bg-white p-1"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(
                      form.checkinUrl
                    )}`}
                  />
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
                      form.checkinUrl
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    開啟 QRCode 圖檔
                  </a>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">狀態</label>
              <select
                value={form.status}
                onChange={(event) => handleChange("status", event.target.value)}
                className="input-sm"
              >
                <option value="draft">草稿</option>
                <option value="open">開放報名</option>
                <option value="closed">已結束</option>
              </select>
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "儲存中..." : activeId ? "更新活動" : "新增活動"}
              </button>
              {!activeId ? (
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  重新產生預設
                </button>
              ) : null}
              {activeId ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveId("");
                    setForm(buildDefaultForm(events));
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  取消編輯
                </button>
              ) : null}
            </div>
          </form>
        </section>
        ) : null}

        {activeTab === "students" ? (
          <section className="card p-7 sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">同學列表</h2>
            <p className="mt-2 text-sm text-slate-500">
              此處顯示 Students 名單，提供未報名統計與快速查詢。
            </p>
          </section>
        ) : null}

        {activeTab === "registrations" ? (
          <section className="card p-7 sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">更新報名狀態</h2>
            <form onSubmit={handleRegistrationSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">報名 ID</label>
                <input
                  value={registrationForm.id}
                  onChange={(event) => setRegistrationForm((prev) => ({ ...prev, id: event.target.value }))}
                  placeholder="輸入報名 ID / 學號 (P...) / 姓名"
                  className="input-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">狀態</label>
                <select
                  value={registrationForm.status}
                  onChange={(event) => setRegistrationForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="input-sm"
                >
                  <option value="registered">已報名</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "更新中..." : "更新狀態"}
                </button>
                {registrationStatusMessage ? (
                  <span className="text-xs font-semibold text-emerald-600">
                    {registrationStatusMessage}
                  </span>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  );
}
