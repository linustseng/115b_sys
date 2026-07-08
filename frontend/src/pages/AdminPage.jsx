import React, { useEffect, useMemo, useRef, useState } from "react";
import { mapAppErrorMessage } from "../utils/errorMappings";
import { downloadXlsx } from "../utils/xlsxExport";
import { QRCodeSVG } from "qrcode.react";
import {
  addDays_,
  addMinutes_,
  generateEventId_,
  pad2_,
  parseDateTimeLikeLocal_,
  parseLocalInputDate_,
  toLocalInput_,
  toLocalInputValue_,
} from "../adminUtils";

export default function AdminPage({
  pageTitle = "系統管理 · 後台",
  apiRequest,
  API_URL,
  UPLOAD_FOLDER_ID,
  getGoogleIdTokenSilently_ = null,
  buildGoogleMapsUrl_,
  formatDisplayDate_,
  getGroupLabel_,
  PUBLIC_SITE_URL,
  GROUP_ROLE_LABELS,
  ROLE_BADGE_STYLES,
  EVENT_CATEGORIES,
  travelTransportationField = {
    id: "travelTransportation",
    label: "旅遊交通方式",
    options: ["全程搭高鐵跟遊覽車", "只搭遊覽車", "全程交通自理"],
  },
  CLASS_GROUPS,
  initialTab = "events",
  allowedTabs = ["events", "ordering", "dietary", "registrations", "checkins", "students"],
}) {
  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [registrationsLoaded, setRegistrationsLoaded] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [checkinsLoaded, setCheckinsLoaded] = useState(false);
  const [orderPlans, setOrderPlans] = useState([]);
  const [orderPlansLoaded, setOrderPlansLoaded] = useState(false);
  const [orderResponses, setOrderResponses] = useState([]);
  const [orderActiveId, setOrderActiveId] = useState("");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [expandedPickedGroups, setExpandedPickedGroups] = useState({});
  const [orderRosterQuery, setOrderRosterQuery] = useState("");
  const [orderOnlyUnpicked, setOrderOnlyUnpicked] = useState(false);
  const [orderMealFocus, setOrderMealFocus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [eventAuditEvents, setEventAuditEvents] = useState([]);
  const [eventAuditLoading, setEventAuditLoading] = useState(false);
  const [eventListId, setEventListId] = useState("");
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
    revisionNo: 0,
  });
  const [registrationForm, setRegistrationForm] = useState({
    id: "",
    status: "registered",
  });
  const [manualRegistrationForm, setManualRegistrationForm] = useState({
    studentQuery: "",
    attendance: "出席",
    travelTransportation: "",
    notes: "",
  });
  const [copyStatus, setCopyStatus] = useState("");
  const [registerCopyStatus, setRegisterCopyStatus] = useState("");
  const [registrationEventId, setRegistrationEventId] = useState("");
  const [checkinEventId, setCheckinEventId] = useState("");
  const [orderStatusMessage, setOrderStatusMessage] = useState("");
  const [orderAuditEvents, setOrderAuditEvents] = useState([]);
  const [orderAuditLoading, setOrderAuditLoading] = useState(false);
  const [unsubmittedOrderCopyStatus, setUnsubmittedOrderCopyStatus] = useState("");
  const [dietaryQuery, setDietaryQuery] = useState("");
  const [orderForm, setOrderForm] = useState({
    id: "",
    date: "",
    title: "",
    optionA: "A 餐",
    optionB: "B 餐",
    optionC: "C 餐",
    optionVegetarian: "素食餐",
    optionAImage: "",
    optionBImage: "",
    optionCImage: "",
    optionVegetarianImage: "",
    cutoffAt: "",
    status: "open",
    notes: "",
    revisionNo: 0,
  });
  const [proxyOrderForm, setProxyOrderForm] = useState({
    id: "",
    displayName: "",
    sourceLabel: "外部修課同學",
    choice: "A",
    comment: "",
  });
  const [publicOrderLinkForm, setPublicOrderLinkForm] = useState({
    id: "",
    orderPlanId: "",
    title: "",
    description: "",
    closeAt: "",
    status: "disabled",
    token: "",
    revisionNo: 0,
  });
  const [studentsQuery, setStudentsQuery] = useState("");
  const [studentsGroupFilter, setStudentsGroupFilter] = useState("all");
  const [studentsSortKey, setStudentsSortKey] = useState("nameZh");
  const [studentsSortDir, setStudentsSortDir] = useState("asc");
  const [unregisteredQuery, setUnregisteredQuery] = useState("");
  const [registrationStatusMessage, setRegistrationStatusMessage] = useState("");
  const [manualRegistrationStatusMessage, setManualRegistrationStatusMessage] = useState("");
  const [groupMemberships, setGroupMemberships] = useState([]);
  const [draftMemberships, setDraftMemberships] = useState([]);
  const [membershipDirty, setMembershipDirty] = useState(false);
  const [membershipQuery, setMembershipQuery] = useState("");
  const [membershipStatus, setMembershipStatus] = useState("");
  const [membershipSaveError, setMembershipSaveError] = useState("");
  const [quickLinks, setQuickLinks] = useState([]);
  const [quickLinksLoaded, setQuickLinksLoaded] = useState(false);
  const [quickLinkStatus, setQuickLinkStatus] = useState("");
  const [quickLinkForm, setQuickLinkForm] = useState({
    id: "",
    title: "",
    url: "",
    description: "",
    category: "學校系統",
    status: "published",
    sortOrder: 100,
  });
  const [lineExportStatus, setLineExportStatus] = useState("");
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
  const directoryLoadedTokenRef = useRef("");
  const publicOrderLinkDraftTouchedRef = useRef(false);
  const publicOrderLinkLoadSeqRef = useRef(0);
  const ALLOWED_UPLOAD_EXTENSIONS = [
    "pdf",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
  ];

  const normalizeEventId_ = (value) => String(value || "").trim();
  const normalizeOrderId_ = (value) => String(value || "").trim();

  const auditFieldLabels_ = {
    title: "標題",
    description: "說明",
    startAt: "開始時間",
    endAt: "結束時間",
    location: "地點",
    address: "地址",
    registrationOpenAt: "報名開始",
    registrationCloseAt: "報名截止",
    checkinOpenAt: "簽到開始",
    checkinCloseAt: "簽到截止",
    registerUrl: "報名連結",
    checkinUrl: "簽到連結",
    capacity: "名額",
    category: "活動類型",
    allowCompanions: "可帶眷屬",
    allowBringDrinks: "可帶飲料",
    attachments: "附件",
    date: "訂餐日期",
    optionA: "A 餐名稱",
    optionB: "B 餐名稱",
    optionC: "C 餐名稱",
    optionVegetarian: "素食餐名稱",
    optionAImage: "A 餐圖片",
    optionBImage: "B 餐圖片",
    optionCImage: "C 餐圖片",
    optionVegetarianImage: "素食餐圖片",
    cutoffAt: "截止時間",
    notes: "備註",
    closeAt: "外部入口關閉時間",
    token: "外部入口 Token",
    orderPlanId: "訂餐日期",
    status: "狀態",
    revisionNo: "版本號",
    createdAt: "建立時間",
    updatedAt: "更新時間",
    lastChangeBatchId: "異動批次",
    lastChangedAt: "最後異動時間",
    lastChangedBy: "最後異動者 ID",
    lastChangedByName: "最後異動者",
  };
  const auditBusinessFieldOrder_ = [
    "title",
    "date",
    "startAt",
    "endAt",
    "location",
    "address",
    "registrationOpenAt",
    "registrationCloseAt",
    "checkinOpenAt",
    "checkinCloseAt",
    "cutoffAt",
    "closeAt",
    "status",
    "category",
    "capacity",
    "allowCompanions",
    "allowBringDrinks",
    "optionA",
    "optionB",
    "optionC",
    "optionVegetarian",
    "optionAImage",
    "optionBImage",
    "optionCImage",
    "optionVegetarianImage",
    "description",
    "notes",
    "registerUrl",
    "checkinUrl",
    "attachments",
    "token",
  ];
  const auditBusinessFieldRank_ = new Map(auditBusinessFieldOrder_.map((key, index) => [key, index]));
  const auditSystemFields_ = new Set([
    "createdAt",
    "updatedAt",
    "revisionNo",
    "lastChangeBatchId",
    "lastChangedAt",
    "lastChangedBy",
    "lastChangedByName",
  ]);
  const eventStatusLabels_ = { draft: "草稿", open: "開放報名", closed: "已結束" };
  const orderStatusLabels_ = { open: "開放", closed: "關閉", disabled: "停用", enabled: "啟用" };
  const yesNoLabels_ = { yes: "是", no: "否", true: "是", false: "否" };

  const formatAuditFieldLabel_ = (key) =>
    auditFieldLabels_[key] || String(key || "").replace(/_/g, " ") || "未命名欄位";

  const formatAuditValue_ = (key, value) => {
    if (value == null || value === "") {
      return "∅";
    }
    const raw = String(value);
    if (key === "status") {
      return eventStatusLabels_[raw] || orderStatusLabels_[raw] || raw;
    }
    if (key === "category") {
      return EVENT_CATEGORIES.find((item) => item.id === raw)?.label || raw;
    }
    if (key === "allowCompanions" || key === "allowBringDrinks") {
      return yesNoLabels_[raw] || raw;
    }
    if (["startAt", "endAt", "registrationOpenAt", "registrationCloseAt", "checkinOpenAt", "checkinCloseAt", "cutoffAt", "closeAt", "createdAt", "updatedAt", "lastChangedAt"].includes(key)) {
      return formatDisplayDate_(value, { withTime: true }) || raw;
    }
    if (["optionAImage", "optionBImage", "optionCImage", "optionVegetarianImage", "registerUrl", "checkinUrl"].includes(key)) {
      return raw ? "已設定連結" : "∅";
    }
    if (key === "attachments") {
      try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (Array.isArray(parsed)) {
          return parsed.length ? `${parsed.length} 個附件` : "無附件";
        }
      } catch (_) {
        // keep fallback below
      }
    }
    if (Array.isArray(value)) {
      return value.length ? value.map((item) => formatAuditValue_(key, item)).join("、") : "∅";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return raw;
  };

  const buildAuditDiffEntries_ = (diff) =>
    Object.entries(diff || {})
      .filter(([key]) => !auditSystemFields_.has(key))
      .sort(([a], [b]) => {
        const aRank = auditBusinessFieldRank_.has(a) ? auditBusinessFieldRank_.get(a) : 999;
        const bRank = auditBusinessFieldRank_.has(b) ? auditBusinessFieldRank_.get(b) : 999;
        return aRank === bRank ? a.localeCompare(b, "zh-Hant") : aRank - bRank;
      });

  const formatAuditActionLabel_ = (action) => {
    const normalized = String(action || "").trim();
    if (normalized === "create") return "建立";
    if (normalized === "update") return "更新";
    if (normalized === "restore") return "回復版本";
    if (normalized === "delete") return "刪除";
    return normalized || "異動";
  };

  const formatAuditEntityLabel_ = (entityType) => {
    const normalized = String(entityType || "").trim();
    if (normalized === "event") return "活動";
    if (normalized === "order_plan") return "訂餐";
    if (normalized === "ordering_public_link") return "外部訂餐入口";
    return normalized.replace(/_/g, " ") || "紀錄";
  };

  const buildAuditSummary_ = (item, diffEntries) => {
    const actionLabel = formatAuditActionLabel_(item && item.action);
    const entityLabel = formatAuditEntityLabel_(item && item.entityType);
    if (!diffEntries.length) {
      return `${actionLabel}${entityLabel}`;
    }
    const labels = diffEntries.slice(0, 3).map(([key]) => formatAuditFieldLabel_(key));
    return `${actionLabel}${entityLabel}：${labels.join("、")}${diffEntries.length > 3 ? ` 等 ${diffEntries.length} 項` : ""}`;
  };

  const normalizeEmail_ = (value) => String(value || "").trim().toLowerCase();

  const normalizeName_ = (value) => String(value || "").trim();

  const getChineseName_ = (student) =>
    String((student && (student.nameZh || student.name || student.preferredName || student.nameEn)) || "").trim();

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

  const getDirectorySortValue_ = (item, key) => {
    if (key === "birthday") {
      return `${String(item.birthdayMonth || "").padStart(2, "0")}${String(item.birthdayDay || "").padStart(2, "0")}`;
    }
    return String(item && item[key] ? item[key] : "").toLowerCase();
  };

  const toggleStudentsSort_ = (nextKey) => {
    if (studentsSortKey === nextKey) {
      setStudentsSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setStudentsSortKey(nextKey);
    setStudentsSortDir("asc");
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

  const normalizeAttendanceStatus_ = (value) => {
    const attendanceValue = String(value || "").trim();
    if (attendanceValue === "出席") {
      return "attending";
    }
    if (attendanceValue === "不克出席") {
      return "not_attending";
    }
    if (
      attendanceValue === "尚未確定" ||
      attendanceValue === "未定" ||
      attendanceValue === "未確認" ||
      !attendanceValue
    ) {
      return "unknown";
    }
    return "unknown";
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
    const parsed = parseDateTimeLikeLocal_(normalized);
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
    const parsed = parseDateTimeLikeLocal_(normalized);
    return parsed && !isNaN(parsed.getTime()) ? parsed : null;
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
  const selectedEventForList =
    sortedEvents.find((item) => normalizeEventId_(item.id) === normalizeEventId_(eventListId)) ||
    sortedEvents[0] ||
    null;

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
      optionC: "C 餐",
      optionVegetarian: "素食餐",
      optionAImage: "",
      optionBImage: "",
      optionCImage: "",
      optionVegetarianImage: "",
      cutoffAt: cutoffAt,
      status: "open",
      notes: "",
      revisionNo: 0,
    };
  };

  const hasOrderVegetarianChoice_ = (plan) =>
    Boolean(String((plan && (plan.optionVegetarian || plan.optionVegetarianImage)) || "").trim());

  const getOrderChoiceOptions_ = (plan) => {
    const hasVegetarianChoice = hasOrderVegetarianChoice_(plan);
    return [
      { value: "A", label: plan.optionA || "A 餐" },
      { value: "B", label: plan.optionB || "B 餐" },
      { value: "C", label: plan.optionC || (hasVegetarianChoice ? "C 餐" : "素食餐") },
      ...(hasVegetarianChoice
        ? [{ value: "VEG", label: plan.optionVegetarian || "素食餐" }]
        : []),
      { value: "NONE", label: "不吃" },
    ];
  };

  const buildDefaultProxyOrderForm = () => ({
    id: "",
    displayName: "",
    sourceLabel: "外部修課同學",
    choice: "A",
    comment: "",
  });

  const isOrderPlanClosedForAdmin_ = (plan) => {
    if (!plan) {
      return true;
    }
    const status = String(plan.status || "").trim().toLowerCase();
    if (status && status !== "open") {
      return true;
    }

    const now = Date.now();
    const cutoffText = String(plan.cutoffAt || plan.closeAt || "").trim();
    if (cutoffText) {
      const normalized =
        /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(cutoffText)
          ? cutoffText.replace(/\//g, "-").replace(" ", "T")
          : cutoffText;
      const cutoff = new Date(normalized);
      if (!Number.isNaN(cutoff.getTime()) && now > cutoff.getTime()) {
        return true;
      }
    }

    const dateText = String(plan.date || "").trim();
    if (dateText) {
      const mealEnd = new Date(`${dateText}T23:59:59+08:00`);
      if (!Number.isNaN(mealEnd.getTime()) && now > mealEnd.getTime()) {
        return true;
      }
    }

    return false;
  };

  const buildDefaultPublicOrderLinkForm = (plan = null, existing = null) => ({
    id: existing && existing.id ? existing.id : "",
    orderPlanId: plan && plan.id ? plan.id : "",
    title: existing && existing.title ? existing.title : plan && plan.title ? `${plan.title}｜外部訂餐` : "",
    description: existing && existing.description ? existing.description : "提供其他班同學 / 學長姐訂餐",
    closeAt: normalizeDateTimeInput_(existing && existing.closeAt ? existing.closeAt : plan && plan.cutoffAt ? plan.cutoffAt : ""),
    status: existing && existing.status ? existing.status : "disabled",
    token: existing && existing.token ? existing.token : "",
    revisionNo: Number((existing && existing.revisionNo) || 0) || 0,
  });

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
      revisionNo: 0,
    };
  };

  const loadEventAuditEvents = async (eventId) => {
    if (!eventId) {
      setEventAuditEvents([]);
      return;
    }
    setEventAuditLoading(true);
    try {
      const { result } = await apiRequest({ action: "listEventAuditEvents", eventId, limit: 20 });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "載入異動紀錄失敗");
      }
      setEventAuditEvents(result.data && result.data.events ? result.data.events : []);
    } catch (err) {
      setEventAuditEvents([]);
    } finally {
      setEventAuditLoading(false);
    }
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
      const message = String((err && err.message) || "活動列表載入失敗。");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入活動列表。",
          forbiddenMessage: "你目前沒有權限查看活動後台。",
          networkMessage: "目前網路或系統回應較慢，活動列表稍後再試。",
          fallbackMessage: "活動列表載入失敗。",
        })
      );
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
      loadEvents();
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
    const shouldLoadDirectory = () => {
      const storedToken = localStorage.getItem("directoryToken") || "";
      const activeToken = storedToken || directoryToken;
      const marker = activeToken || "__session__";
      return directoryLoadedTokenRef.current !== marker;
    };
    if (activeTab === "registrations") {
      if (!registrationsLoaded) {
        loadAdminBootstrap({ includeRegistrations: true }).then((ok) => {
          if (!ok) {
            loadRegistrations();
          }
        });
      }
      if (shouldLoadDirectory()) {
        loadDirectoryAdmin();
      }
    }
    if (activeTab === "checkins") {
      if (!checkinsLoaded || !registrationsLoaded) {
        loadAdminBootstrap({ includeRegistrations: true, includeCheckins: true }).then((ok) => {
          if (!ok) {
            if (!checkinsLoaded) {
              loadCheckins();
            }
            if (!registrationsLoaded) {
              loadRegistrations();
            }
          }
        });
      }
      if (shouldLoadDirectory()) {
        loadDirectoryAdmin();
      }
    }
    if (activeTab === "students") {
      if (!students.length) {
        loadStudents();
      }
      if (shouldLoadDirectory()) {
        loadDirectoryAdmin();
      }
    }
    if (activeTab === "roles") {
      if (!groupMemberships.length) {
        loadGroupMemberships();
      }
      if (!students.length) {
        loadStudents();
      }
    }
    if (activeTab === "quickLinks") {
      if (!quickLinksLoaded) {
        loadQuickLinksAdmin();
      }
    }
    if (activeTab === "ordering") {
      if (!orderPlansLoaded) {
        loadOrderPlans();
      }
      if (!students.length) {
        loadStudents();
      }
      if (shouldLoadDirectory()) {
        loadDirectoryAdmin();
      }
    }
    if (activeTab === "dietary") {
      if (!students.length) {
        loadStudents();
      }
      if (shouldLoadDirectory()) {
        loadDirectoryAdmin();
      }
    }
  }, [
    activeTab,
    directoryToken,
    registrationsLoaded,
    checkinsLoaded,
    orderPlansLoaded,
    quickLinksLoaded,
    students.length,
    groupMemberships.length,
  ]);

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
    if (!sortedEvents.length) {
      if (eventListId) {
        setEventListId("");
      }
      return;
    }
    const hasSelected = sortedEvents.some(
      (item) => normalizeEventId_(item.id) === normalizeEventId_(eventListId)
    );
    if (!eventListId || !hasSelected) {
      setEventListId(sortedEvents[0].id || "");
    }
  }, [sortedEvents, eventListId]);

  useEffect(() => {
    if (activeTab !== "events" || !selectedEventForList) {
      return;
    }
    const selectedId = normalizeEventId_(selectedEventForList.id);
    if (!selectedId) {
      return;
    }
    if (normalizeEventId_(activeId) === selectedId) {
      return;
    }
    handleEdit(selectedEventForList);
  }, [activeTab, selectedEventForList, isEventFormOpen, activeId]);

  useEffect(() => {
    if (activeTab !== "ordering" || isCreatingOrder) {
      return;
    }
    if (!orderPlans.length) {
      if (orderActiveId) {
        setOrderActiveId("");
      }
      setOrderForm(buildDefaultOrderForm());
      return;
    }
    const hasSelected = orderPlans.some(
      (plan) => normalizeOrderId_(plan.id) === normalizeOrderId_(orderActiveId)
    );
    if (!orderActiveId || !hasSelected) {
      setOrderActiveId(normalizeOrderId_(orderPlans[0].id));
    }
  }, [activeTab, orderActiveId, orderPlans, isCreatingOrder]);

  useEffect(() => {
    if (activeTab !== "ordering" || isCreatingOrder) {
      return;
    }
    const normalizedId = normalizeOrderId_(orderActiveId);
    if (!normalizedId) {
      return;
    }
    const selected = orderPlans.find(
      (plan) => normalizeOrderId_(plan.id) === normalizedId
    );
    if (!selected) {
      return;
    }
    loadOrderResponses(normalizedId);
    loadOrderAuditEvents(normalizedId);
    setProxyOrderForm(buildDefaultProxyOrderForm());
    setOrderForm({
      id: selected.id || "",
      date: normalizeDateInput_(selected.date),
      title: selected.title || "",
      optionA: selected.optionA || "A 餐",
      optionB: selected.optionB || "B 餐",
      optionC: selected.optionC || (hasOrderVegetarianChoice_(selected) ? "C 餐" : "素食餐"),
      optionVegetarian: selected.optionVegetarian || "",
      optionAImage: selected.optionAImage || "",
      optionBImage: selected.optionBImage || "",
      optionCImage: selected.optionCImage || "",
      optionVegetarianImage: selected.optionVegetarianImage || "",
      cutoffAt: normalizeDateTimeInput_(selected.cutoffAt),
      status: selected.status || "open",
      notes: selected.notes || "",
      revisionNo: Number(selected.revisionNo || 0) || 0,
    });
    loadOrderPublicLink(normalizedId, selected, { resetDraft: true });
  }, [activeTab, orderActiveId, orderPlans, isCreatingOrder]);

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
            {
              name: attachment.name || attachment.url,
              url: attachment.url,
              fileId: attachment.fileId || "",
              size: attachment.size || 0,
              contentType: attachment.contentType || "",
            },
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
    setEventListId(event.id || "");
    setActiveId(event.id || "");
    setIsEventFormOpen(true);
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
      revisionNo: Number(event.revisionNo || 0) || 0,
    });
    loadEventAuditEvents(event.id || "");
  };

  const handleSelectEventForEdit = (eventId) => {
    const selectedId = String(eventId || "").trim();
    setEventListId(selectedId);
    const selected = sortedEvents.find(
      (item) => normalizeEventId_(item.id) === normalizeEventId_(selectedId)
    );
    if (selected) {
      handleEdit(selected);
    }
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
      const message = String((err && err.message) || "同學名單載入失敗。");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入同學名單。",
          forbiddenMessage: "你目前沒有權限查看同學名單。",
          networkMessage: "目前網路或系統回應較慢，同學名單稍後再試。",
          fallbackMessage: "同學名單載入失敗。",
        })
      );
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
    const marker = activeToken || "__session__";
    setLoading(true);
    setError("");
    try {
      // Directory is session-first now. Avoid triggering extra Google auth prompts.
      const payload = activeToken ? { action: "listDirectory", authToken: activeToken } : { action: "listDirectory" };
      const { result } = await apiRequest(payload);
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setDirectory(result.data && result.data.directory ? result.data.directory : []);
      directoryLoadedTokenRef.current = marker;
    } catch (err) {
      setDirectory([]);
      const message = String((err && err.message) || "通訊錄載入失敗");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入通訊錄。",
          forbiddenMessage: "你目前沒有權限查看通訊錄。",
          networkMessage: "目前網路或系統回應較慢，通訊錄稍後再試。",
          fallbackMessage: message,
        })
      );
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
      setRegistrationsLoaded(true);
    } catch (err) {
      const message = String((err && err.message) || "報名名單載入失敗。");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入報名名單。",
          forbiddenMessage: "你目前沒有權限查看報名名單。",
          networkMessage: "目前網路或系統回應較慢，報名名單稍後再試。",
          fallbackMessage: "報名名單載入失敗。",
        })
      );
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
      const message = String((err && err.message) || "班務分組載入失敗。");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入班務分組。",
          forbiddenMessage: "你目前沒有權限查看班務分組。",
          networkMessage: "目前網路或系統回應較慢，班務分組稍後再試。",
          fallbackMessage: message,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const resetQuickLinkForm_ = () => {
    setQuickLinkForm({
      id: "",
      title: "",
      url: "",
      description: "",
      category: "學校系統",
      status: "published",
      sortOrder: 100,
    });
    setQuickLinkStatus("");
  };

  const loadQuickLinksAdmin = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listQuickLinks", includeArchived: true });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setQuickLinks(result.data && Array.isArray(result.data.quickLinks) ? result.data.quickLinks : []);
      setQuickLinksLoaded(true);
    } catch (err) {
      const message = String((err && err.message) || "常用鏈結載入失敗。");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入常用鏈結。",
          forbiddenMessage: "你目前沒有權限維護常用鏈結。",
          networkMessage: "目前網路或系統回應較慢，常用鏈結稍後再試。",
          fallbackMessage: message,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuickLink_ = (item) => {
    setQuickLinkForm({
      id: String((item && item.id) || "").trim(),
      title: String((item && item.title) || "").trim(),
      url: String((item && item.url) || "").trim(),
      description: String((item && item.description) || "").trim(),
      category: String((item && item.category) || "學校系統").trim(),
      status: String((item && item.status) || "published").trim(),
      sortOrder: Number((item && item.sortOrder) || 100),
    });
    setQuickLinkStatus("正在編輯既有鏈結");
  };

  const handleSaveQuickLink_ = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setQuickLinkStatus("");
    try {
      const { result } = await apiRequest({ action: "upsertQuickLink", ...quickLinkForm });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      resetQuickLinkForm_();
      setQuickLinkStatus("已儲存常用鏈結。");
      await loadQuickLinksAdmin();
    } catch (err) {
      setError(String((err && err.message) || "常用鏈結儲存失敗。"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuickLink_ = async (item) => {
    const id = String((item && item.id) || "").trim();
    if (!id) {
      return;
    }
    if (!window.confirm(`確定刪除「${item.title || id}」？`)) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "deleteQuickLink", id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      resetQuickLinkForm_();
      setQuickLinkStatus("已刪除常用鏈結。");
      await loadQuickLinksAdmin();
    } catch (err) {
      setError(String((err && err.message) || "常用鏈結刪除失敗。"));
    } finally {
      setSaving(false);
    }
  };

  const loadAdminBootstrap = async (options = {}) => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({
        action: "listAdminBootstrap",
        includeRegistrations: options.includeRegistrations === true,
        includeCheckins: options.includeCheckins === true,
      });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const data = result.data || {};
      setEvents(data.events || []);
      const studentsList = data.students || [];
      setStudents(studentsList);
      setGroupMemberships(data.groupMemberships || []);
      setDraftMemberships(data.groupMemberships || []);
      if (options.includeRegistrations && data.registrations) {
        setRegistrations(data.registrations);
        setRegistrationsLoaded(true);
      }
      if (options.includeCheckins && data.checkins) {
        setCheckins(data.checkins);
        setCheckinsLoaded(true);
      }
      setMembershipDirty(false);
      setMembershipStatus("");
      return true;
    } catch (err) {
      const message = String((err && err.message) || "後台資料載入失敗。");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入後台資料。",
          forbiddenMessage: "你目前沒有權限使用此後台。",
          networkMessage: "目前網路或系統回應較慢，後台資料稍後再試。",
          fallbackMessage: message,
        })
      );
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
      setCheckinsLoaded(true);
    } catch (err) {
      const message = String((err && err.message) || "簽到名單載入失敗。");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入簽到名單。",
          forbiddenMessage: "你目前沒有權限查看簽到名單。",
          networkMessage: "目前網路或系統回應較慢，簽到名單稍後再試。",
          fallbackMessage: "簽到名單載入失敗。",
        })
      );
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
      setOrderPlansLoaded(true);
    } catch (err) {
      const message = String((err && err.message) || "訂餐設定載入失敗。");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入訂餐設定。",
          forbiddenMessage: "你目前沒有權限查看訂餐設定。",
          networkMessage: "目前網路或系統回應較慢，訂餐設定稍後再試。",
          fallbackMessage: "訂餐設定載入失敗。",
        })
      );
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
      const message = String((err && err.message) || "訂餐名單載入失敗。");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入訂餐名單。",
          forbiddenMessage: "你目前沒有權限查看訂餐名單。",
          networkMessage: "目前網路或系統回應較慢，訂餐名單稍後再試。",
          fallbackMessage: "訂餐名單載入失敗。",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const loadOrderPublicLink = async (orderId, plan = null, options = {}) => {
    const resetDraft = Boolean(options && options.resetDraft);
    const requestSeq = ++publicOrderLinkLoadSeqRef.current;
    if (resetDraft) {
      publicOrderLinkDraftTouchedRef.current = false;
    }
    if (!orderId) {
      setPublicOrderLinkForm(buildDefaultPublicOrderLinkForm(plan, null));
      return;
    }
    try {
      const { result } = await apiRequest({ action: "getOrderPublicLinkAdmin", orderPlanId: orderId });
      const existing = result && result.ok && result.data ? result.data.publicLink || null : null;
      if (requestSeq !== publicOrderLinkLoadSeqRef.current) {
        return;
      }
      if (publicOrderLinkDraftTouchedRef.current && !resetDraft) {
        return;
      }
      setPublicOrderLinkForm(buildDefaultPublicOrderLinkForm(plan, existing));
    } catch (err) {
      if (requestSeq !== publicOrderLinkLoadSeqRef.current) {
        return;
      }
      setPublicOrderLinkForm((prev) => {
        if (String(prev.orderPlanId || "") === String(orderId || "").trim()) {
          return prev;
        }
        return buildDefaultPublicOrderLinkForm(plan, null);
      });
    }
  };

  const loadOrderAuditEvents = async (orderId) => {
    if (!orderId) {
      setOrderAuditEvents([]);
      return;
    }
    setOrderAuditLoading(true);
    try {
      const { result } = await apiRequest({ action: "listOrderAuditEvents", orderPlanId: orderId, limit: 20 });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "載入異動紀錄失敗");
      }
      setOrderAuditEvents(result.data && result.data.events ? result.data.events : []);
    } catch (err) {
      setOrderAuditEvents([]);
    } finally {
      setOrderAuditLoading(false);
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

  const resolveStudentForManualRegistration_ = (inputValue, sourceStudents) => {
    const keyword = String(inputValue || "").trim();
    if (!keyword) {
      return null;
    }
    const candidates = Array.isArray(sourceStudents) ? sourceStudents : [];
    const normalizedKeyword = normalizeEmail_(keyword);
    const normalizedNameKeyword = keyword.toLowerCase();

    const idMatches = candidates.filter((item) => String(item.id || "").trim() === keyword);
    if (idMatches.length > 1) {
      throw new Error("找到多筆同學資料，請改用 Email。");
    }
    if (idMatches.length === 1) {
      return idMatches[0];
    }

    const emailMatches = candidates.filter((item) => {
      const email = normalizeEmail_(item.email);
      const googleEmail = normalizeEmail_(item.googleEmail);
      return normalizedKeyword && (email === normalizedKeyword || googleEmail === normalizedKeyword);
    });
    if (emailMatches.length > 1) {
      throw new Error("找到多筆相同 Email 的同學資料，請聯繫資管組處理。");
    }
    if (emailMatches.length === 1) {
      return emailMatches[0];
    }

    const nameMatches = candidates.filter((item) => {
      const names = [
        item.nameZh,
        item.name,
        item.preferredName,
        item.nameEn,
      ]
        .map((value) => normalizeName_(value).toLowerCase())
        .filter(Boolean);
      return names.includes(normalizedNameKeyword);
    });
    if (nameMatches.length > 1) {
      throw new Error("找到多筆同名同學，請改用學號或 Email。");
    }
    if (nameMatches.length === 1) {
      return nameMatches[0];
    }
    return null;
  };

  const handleManualRegistrationSubmit = async (event) => {
    event.preventDefault();
    const studentQuery = String(manualRegistrationForm.studentQuery || "").trim();
    if (!registrationEventId) {
      setError("請先選擇活動。");
      return;
    }
    if (!studentQuery) {
      setError("請先輸入學號、Email 或姓名。");
      return;
    }
    setSaving(true);
    setError("");
    setManualRegistrationStatusMessage("");
    try {
      const sourceStudents = directory.length ? directory : students;
      const targetStudent = resolveStudentForManualRegistration_(studentQuery, sourceStudents);
      if (!targetStudent) {
        throw new Error("找不到對應同學，請確認學號/Email/姓名。");
      }
      const studentId = String(targetStudent.id || "").trim();
      const userEmail = normalizeEmail_(targetStudent.email || targetStudent.googleEmail);
      if (!userEmail) {
        throw new Error("該同學缺少 Email，無法補報名。");
      }
      const userName =
        getChineseName_(targetStudent) ||
        getDisplayName_(targetStudent) ||
        String(targetStudent.name || "").trim() ||
        userEmail;
      const attendance = String(manualRegistrationForm.attendance || "").trim() || "尚未確定";
      const travelTransportation = String(manualRegistrationForm.travelTransportation || "").trim();
      const shouldAskTravelTransportation =
        isRegistrationTravelEvent && normalizeAttendanceStatus_(attendance) === "attending";
      if (shouldAskTravelTransportation && !travelTransportation) {
        throw new Error("旅遊活動請選擇交通方式。");
      }
      const notes = String(manualRegistrationForm.notes || "").trim();
      const dietaryPreference = String(targetStudent.dietaryRestrictions || targetStudent.dietary || "").trim();
      const customFields = {
        attendance: attendance,
        studentId: studentId,
        name: userName,
      };
      if (dietaryPreference) {
        customFields.dietary = dietaryPreference;
      }
      if (shouldAskTravelTransportation) {
        customFields.travelTransportation = travelTransportation;
      }
      if (notes) {
        customFields.notes = notes;
      }
      const { result } = await apiRequest({
        action: "adminCreateRegistration",
        data: {
          eventId: registrationEventId,
          studentId: studentId,
          userEmail: userEmail,
          userName: userName,
          userPhone: String(targetStudent.mobile || targetStudent.phone || "").trim(),
          customFields: customFields,
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "補報名失敗");
      }
      await loadRegistrations();
      setManualRegistrationForm((prev) => ({
        ...prev,
        studentQuery: "",
        travelTransportation: "",
        notes: "",
      }));
      setManualRegistrationStatusMessage("已完成補報名");
    } catch (err) {
      setError(err.message || "補報名失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleOrderFormChange = (key, value) => {
    if ((key === "optionAImage" || key === "optionBImage" || key === "optionCImage" || key === "optionVegetarianImage") && String(value || "").startsWith("data:")) {
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
    setIsCreatingOrder(true);
    setOrderActiveId("");
    setOrderForm(buildDefaultOrderForm());
    setOrderResponses([]);
    setOrderAuditEvents([]);
    setProxyOrderForm(buildDefaultProxyOrderForm());
    setOrderStatusMessage("");
  };

  const handleDeleteOrderPlan = async () => {
    if (!orderForm.id) {
      handleOrderReset();
      setOrderStatusMessage("已取消新增訂餐日期");
      return;
    }

    const responseCount = normalizeOrderId_(orderForm.id) === normalizeOrderId_(orderActiveId)
      ? orderResponses.length
      : 0;
    const planLabel = activeOrderLabel || formatOrderDateLabel_(orderForm.date) || orderForm.title || "這筆訂餐日期";
    const warning = responseCount
      ? `「${planLabel}」目前已有 ${responseCount} 筆訂餐名單。刪除後會連同訂餐回覆一起刪除，確定要刪除嗎？`
      : `確定要刪除「${planLabel}」嗎？`;
    if (!confirmDelete_(warning)) {
      return;
    }

    setSaving(true);
    setError("");
    setOrderStatusMessage("");
    try {
      const { result } = await apiRequest({ action: "deleteOrderPlan", id: orderForm.id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      setIsCreatingOrder(false);
      setOrderActiveId("");
      setOrderForm(buildDefaultOrderForm());
      setOrderResponses([]);
      setOrderAuditEvents([]);
      setProxyOrderForm(buildDefaultProxyOrderForm());
      await loadOrderPlans();
      const deletedResponses = Number((result.data && result.data.deletedResponses) || 0);
      setOrderStatusMessage(
        deletedResponses > 0 ? `已刪除訂餐日期，並移除 ${deletedResponses} 筆訂餐回覆` : "已刪除訂餐日期"
      );
    } catch (err) {
      setOrderStatusMessage(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleOrderSave = async (event) => {
    event.preventDefault();
    if (!orderForm.date) {
      setOrderStatusMessage("請先選擇日期。");
      return;
    }
    if (
      String(orderForm.optionAImage || "").startsWith("data:") ||
      String(orderForm.optionBImage || "").startsWith("data:") ||
      String(orderForm.optionCImage || "").startsWith("data:") ||
      String(orderForm.optionVegetarianImage || "").startsWith("data:")
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
          expectedRevision: Number(orderForm.revisionNo || 0) || 0,
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
      const returnedPlan = result.data && result.data.plan ? result.data.plan : null;
      const returnedId = String(
        (result.data && (result.data.id || result.data.planId)) || (returnedPlan && returnedPlan.id) || orderForm.id || ""
      ).trim();
      const isCreate = !orderForm.id;
      await loadOrderPlans();
      if (returnedId) {
        setOrderActiveId(normalizeOrderId_(returnedId));
        await loadOrderAuditEvents(normalizeOrderId_(returnedId));
      }
      setIsCreatingOrder(false);
      setOrderStatusMessage(isCreate ? "已新增訂餐日期" : "已更新訂餐設定");
    } catch (err) {
      if (String(err.message || "").includes("重新整理") || String(err.message || "").includes("不能直接修改日期")) {
        await loadOrderPlans();
        if (orderActiveId) {
          await loadOrderAuditEvents(normalizeOrderId_(orderActiveId));
        }
      }
      setOrderStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleProxyOrderSubmit = async (event) => {
    event.preventDefault();
    if (!orderActiveId) {
      setOrderStatusMessage("請先選擇訂餐日期。");
      return;
    }
    if (!String(proxyOrderForm.displayName || "").trim()) {
      setOrderStatusMessage("請先輸入代訂姓名。");
      return;
    }
    setSaving(true);
    setError("");
    setOrderStatusMessage("");
    try {
      const { result } = await apiRequest({
        action: "adminUpsertOrderProxyResponse",
        data: {
          ...proxyOrderForm,
          orderId: normalizeOrderId_(orderActiveId),
          displayName: String(proxyOrderForm.displayName || "").trim(),
          sourceLabel: String(proxyOrderForm.sourceLabel || "").trim() || "外部修課同學",
          comment: String(proxyOrderForm.comment || "").trim(),
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      await loadOrderResponses(normalizeOrderId_(orderActiveId));
      setProxyOrderForm(buildDefaultProxyOrderForm());
      setOrderStatusMessage("已更新代訂餐");
    } catch (err) {
      setOrderStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrderPublicLink = async (event) => {
    event.preventDefault();
    if (!orderActiveId) {
      setOrderStatusMessage("請先選擇訂餐日期。");
      return;
    }
    setSaving(true);
    setError("");
    setOrderStatusMessage("");
    try {
      const { result } = await apiRequest({
        action: "upsertOrderPublicLink",
        expectedRevision: Number(publicOrderLinkForm.revisionNo || 0) || 0,
        data: {
          ...publicOrderLinkForm,
          orderPlanId: normalizeOrderId_(orderActiveId),
          status: publicOrderLinkForm.status || "disabled",
        },
      });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "儲存失敗");
      }
      const saved = result.data && result.data.publicLink ? result.data.publicLink : null;
      if (saved) {
        setPublicOrderLinkForm(buildDefaultPublicOrderLinkForm(activeOrderPlan, saved));
        publicOrderLinkDraftTouchedRef.current = false;
      }
      await loadOrderPublicLink(normalizeOrderId_(orderActiveId), activeOrderPlan, { resetDraft: true });
      await loadOrderAuditEvents(normalizeOrderId_(orderActiveId));
      setOrderStatusMessage(publicOrderLinkForm.status === "active" ? "已更新外部訂餐入口" : "已儲存外部訂餐設定");
    } catch (err) {
      setOrderStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreOrderAuditVersion = async (item) => {
    if (!item || !item.versionId) {
      return;
    }
    if (!canRestoreActiveOrder || item.canRestoreVersion === false) {
      setOrderStatusMessage(item.restoreBlockedReason || orderRestoreBlockedReason);
      return;
    }
    const entityLabel = item.entityType === "ordering_public_link" ? "外部訂餐入口" : "訂餐設定";
    if (!window.confirm(`確定要回復這筆${entityLabel}到 ${formatDisplayDate_(item.createdAt, { withTime: true }) || item.createdAt} 的版本嗎？`)) {
      return;
    }
    setSaving(true);
    setError("");
    setOrderStatusMessage("");
    try {
      const { result } = await apiRequest({ action: "restoreOrderAuditVersion", versionId: item.versionId });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "回復失敗");
      }
      await loadOrderPlans();
      if (orderActiveId) {
        await loadOrderAuditEvents(normalizeOrderId_(orderActiveId));
        await loadOrderPublicLink(normalizeOrderId_(orderActiveId), activeOrderPlan, { resetDraft: true });
      }
      setOrderStatusMessage(`已回復${entityLabel}`);
    } catch (err) {
      setOrderStatusMessage(err.message || "回復失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleEditProxyOrder = (item) => {
    setProxyOrderForm({
      id: item.id || "",
      displayName: item.displayName || item.studentName || "",
      sourceLabel: item.sourceLabel || "外部修課同學",
      choice: String(item.choice || "A").toUpperCase() || "A",
      comment: item.comment || "",
    });
  };

  const handleDeleteProxyOrder = async (id) => {
    if (!id) {
      return;
    }
    if (!confirmDelete_("確定要刪除這筆代訂餐嗎？")) {
      return;
    }
    setSaving(true);
    setError("");
    setOrderStatusMessage("");
    try {
      const { result } = await apiRequest({ action: "deleteOrderProxyResponse", id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadOrderResponses(normalizeOrderId_(orderActiveId));
      if (normalizeOrderId_(proxyOrderForm.id) === normalizeOrderId_(id)) {
        setProxyOrderForm(buildDefaultProxyOrderForm());
      }
      setOrderStatusMessage("已刪除代訂餐");
    } catch (err) {
      setOrderStatusMessage(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSetOrderPickedUp = async (item, pickedUp) => {
    const responseId = normalizeOrderId_(item && item.id);
    if (!responseId) {
      return;
    }
    setSaving(true);
    setError("");
    setOrderStatusMessage("");
    try {
      const { result } = await apiRequest({
        action: pickedUp ? "markOrderResponsePickedUp" : "unmarkOrderResponsePickedUp",
        id: responseId,
      });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      await loadOrderResponses(normalizeOrderId_(orderActiveId));
      setOrderStatusMessage(pickedUp ? "已標記取餐" : "已取消取餐標記");
    } catch (err) {
      setOrderStatusMessage(err.message || "更新失敗");
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
      const normalizedMemberships = draftMemberships.map((item) => ({
        id: item.id,
        personId: item.personId,
        personName: item.personName,
        groupId: item.groupId,
        roleInGroup: item.roleInGroup,
        notes: item.notes || "",
      }));

      const { result } = await apiRequest({
        action: "batchUpdateGroupMemberships",
        data: {
          memberships: normalizedMemberships,
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

  const buildLineMembershipExportText_ = () => {
    const normalizeRoleOrder = (role) => {
      if (role === "lead") return 0;
      if (role === "deputy") return 1;
      return 2;
    };
    const getRoleTitle = (groupId, role) => {
      if (groupId === "A") {
        if (role === "lead") return "班代";
        if (role === "deputy") return "副班代";
      }
      return GROUP_ROLE_LABELS[role] || role || "成員";
    };
    const sortByName = (items) =>
      items
        .slice()
        .sort((a, b) =>
          normalizeName_(a.personName || "").localeCompare(normalizeName_(b.personName || ""), "zh-Hant")
        );

    const sections = CLASS_GROUPS.map((group) => {
      const items = sortByName(
        draftMemberships.filter((item) => String(item.groupId || "").trim() === String(group.id || "").trim())
      ).sort((a, b) => {
        const roleDiff = normalizeRoleOrder(String(a.roleInGroup || "").trim()) - normalizeRoleOrder(String(b.roleInGroup || "").trim());
        if (roleDiff !== 0) {
          return roleDiff;
        }
        return normalizeName_(a.personName || "").localeCompare(normalizeName_(b.personName || ""), "zh-Hant");
      });
      if (!items.length) {
        return `【${group.label}】\n（尚未配置）`;
      }
      const roleBuckets = {
        lead: items.filter((item) => String(item.roleInGroup || "").trim() === "lead"),
        deputy: items.filter((item) => String(item.roleInGroup || "").trim() === "deputy"),
        member: items.filter((item) => String(item.roleInGroup || "").trim() === "member"),
      };
      const lines = [`【${group.label}】`];
      if (roleBuckets.lead.length) {
        lines.push(`${getRoleTitle(group.id, "lead")}：${roleBuckets.lead.map((item) => item.personName || item.personId).join("、")}`);
      }
      if (roleBuckets.deputy.length) {
        lines.push(`${getRoleTitle(group.id, "deputy")}：${roleBuckets.deputy.map((item) => item.personName || item.personId).join("、")}`);
      }
      if (roleBuckets.member.length) {
        lines.push(`成員：${roleBuckets.member.map((item) => item.personName || item.personId).join("、")}`);
      }
      const extraRoles = items.filter((item) => !["lead", "deputy", "member"].includes(String(item.roleInGroup || "").trim()));
      extraRoles.forEach((item) => {
        lines.push(`${getRoleTitle(group.id, String(item.roleInGroup || "").trim())}：${item.personName || item.personId}`);
      });
      return lines.join("\n");
    });

    return sections.join("\n\n");
  };

  const handleCopyLineMembershipExport_ = async () => {
    const text = buildLineMembershipExportText_();
    if (!text) {
      setLineExportStatus("沒有可匯出的分組資料");
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard unavailable");
      }
      setLineExportStatus("已複製 LINE 版各組名單");
    } catch (error) {
      setLineExportStatus("複製失敗");
    } finally {
      window.setTimeout(() => setLineExportStatus(""), 2500);
    }
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
      const currentRevision = Number(
        (events.find((item) => String(item.id || "").trim() === String(eventId).trim()) || {}).revisionNo || 0
      ) || 0;
      const { result } = await apiRequest({ action: "deleteEvent", eventId: eventId, expectedRevision: currentRevision });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadEvents();
      if (activeId === eventId) {
        setActiveId("");
        setIsEventFormOpen(false);
        setEventAuditEvents([]);
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
      const { result } = await apiRequest({ action: action, expectedRevision: Number(form.revisionNo || 0) || 0, data: form });
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
      setIsEventFormOpen(false);
      setForm(buildDefaultForm(events));
      setEventAuditEvents([]);
      await loadEvents();
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreEventAuditVersion = async (item) => {
    if (!item || !item.versionId) {
      return;
    }
    if (!canRestoreActiveEvent || item.canRestoreVersion === false) {
      setError(item.restoreBlockedReason || eventRestoreBlockedReason);
      return;
    }
    if (!window.confirm(`確定要回復這版活動設定嗎？\n\n時間：${formatDisplayDate_(item.createdAt, { withTime: true }) || item.createdAt}`)) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "restoreEventAuditVersion", versionId: item.versionId });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "回復失敗");
      }
      const restoredEvent = result.data && result.data.event ? result.data.event : null;
      if (restoredEvent) {
        setForm({
          id: restoredEvent.id || "",
          title: restoredEvent.title || "",
          description: restoredEvent.description || "",
          startAt: normalizeEventDateTimeValue_(restoredEvent.startAt),
          endAt: normalizeEventDateTimeValue_(restoredEvent.endAt),
          location: restoredEvent.location || "",
          address: restoredEvent.address || "",
          registrationOpenAt: normalizeEventDateTimeValue_(restoredEvent.registrationOpenAt),
          registrationCloseAt: normalizeEventDateTimeValue_(restoredEvent.registrationCloseAt),
          checkinOpenAt: normalizeEventDateTimeValue_(restoredEvent.checkinOpenAt),
          checkinCloseAt: normalizeEventDateTimeValue_(restoredEvent.checkinCloseAt),
          registerUrl: restoredEvent.registerUrl || "",
          checkinUrl: restoredEvent.checkinUrl || "",
          capacity: restoredEvent.capacity || "",
          status: restoredEvent.status || "draft",
          category: restoredEvent.category || "gathering",
          allowCompanions: restoredEvent.allowCompanions || "yes",
          allowBringDrinks: restoredEvent.allowBringDrinks || "yes",
          attachments: restoredEvent.attachments || "[]",
          revisionNo: Number(restoredEvent.revisionNo || 0) || 0,
        });
      }
      await loadEvents();
      const restoredId = (restoredEvent && restoredEvent.id) || item.entityId || activeId;
      if (restoredId) {
        await loadEventAuditEvents(restoredId);
      }
      setError("");
    } catch (err) {
      setError(err.message || "回復失敗");
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

  const handleCopyUnsubmittedOrderMentions = async () => {
    if (!activeSavedOrderId) {
      setUnsubmittedOrderCopyStatus("請先選擇已儲存的訂餐日期");
      setTimeout(() => setUnsubmittedOrderCopyStatus(""), 1800);
      return;
    }
    if (!unsubmittedOrderStudents.length) {
      setUnsubmittedOrderCopyStatus("目前沒有未訂餐名單");
      setTimeout(() => setUnsubmittedOrderCopyStatus(""), 1800);
      return;
    }
    const mentionLines = unsubmittedOrderStudents
      .map((student) => {
        const studentId = String((student && student.id) || "").trim();
        const mentionName =
          getChineseName_(student) ||
          getDisplayName_(student) ||
          studentLabelByStudentId.get(studentId) ||
          studentId ||
          "未命名";
        return `@${mentionName}`;
      })
      .filter(Boolean);
    const text = [activeOrderLabel ? `未訂餐提醒｜${activeOrderLabel}` : "未訂餐提醒", mentionLines.join(" ")]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setUnsubmittedOrderCopyStatus("已複製 @名單");
    } catch (err) {
      setUnsubmittedOrderCopyStatus("複製失敗");
    } finally {
      setTimeout(() => setUnsubmittedOrderCopyStatus(""), 1800);
    }
  };

  const handleCategoryChange = (value) => {
    setForm((prev) => {
      const next = {
        ...prev,
        category: value,
        ...(value === "travel" ? { allowCompanions: "no", allowBringDrinks: "no" } : {}),
      };
      if (!activeId) {
        const fallbackDate = parseLocalInputDate_(prev.startAt) || addDays_(new Date(), 10);
        next.id = generateEventId_(fallbackDate, value, events, seedTimestamp);
        const baseUrl = normalizeBaseUrl_(PUBLIC_SITE_URL) || window.location.origin;
        next.registerUrl = `${baseUrl}/register?eventId=${encodeURIComponent(next.id)}`;
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
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("檔案超過 10MB 上限");
      if (uploadFileRef.current) {
        uploadFileRef.current.value = "";
      }
      return;
    }
    const extension = String(file.name || "").includes(".")
      ? String(file.name || "").split(".").pop().toLowerCase()
      : "";
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
      setUploadError("檔案格式不支援");
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
        next.checkinUrl = `${baseUrl}/checkin?eventId=${encodeURIComponent(next.id)}`;
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

  const handleStartCreateEvent = () => {
    setError("");
    setActiveId("");
    setForm(buildDefaultForm(events));
    setIsEventFormOpen(true);
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
  const activeEventId = normalizeEventId_(activeId || form.id);
  const activeEventRegistrationCount = (registrationsByEvent[activeEventId] || []).filter(
    (item) => String(item.status || "submitted").trim().toLowerCase() !== "cancelled"
  ).length;
  const activeEventCheckinCount = (checkinsByEvent[activeEventId] || []).length;
  const canRestoreActiveEvent =
    Boolean(activeEventId) &&
    String(form.status || "").trim().toLowerCase() === "draft" &&
    activeEventRegistrationCount + activeEventCheckinCount === 0;
  const eventRestoreBlockedReason =
    activeEventRegistrationCount + activeEventCheckinCount > 0
      ? "這個活動已有報名或簽到紀錄，不能直接回復舊版。"
      : "只有草稿活動可以直接回復舊版。";

  const registrationList = registrationEventId
    ? registrationsByEvent[normalizeEventId_(registrationEventId)] || []
    : registrations;
  const selectedRegistrationEvent =
    sortedEvents.find(
      (event) => normalizeEventId_(event.id) === normalizeEventId_(registrationEventId)
    ) || null;
  const registrationAllowCompanions =
    String((selectedRegistrationEvent && selectedRegistrationEvent.allowCompanions) || "yes").trim() !==
    "no";
  const registrationAllowBringDrinks =
    String((selectedRegistrationEvent && selectedRegistrationEvent.allowBringDrinks) || "yes").trim() !==
    "no";
  const isRegistrationTravelEvent =
    String((selectedRegistrationEvent && selectedRegistrationEvent.category) || "").trim() ===
    "travel";
  const displayStudents = directory.length ? directory : students;
  const parseTimestampValue_ = (value) => {
    if (!value) {
      return 0;
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  const isVegetarianDietary_ = (value) => {
    const text = String(value || "").trim();
    if (!text) {
      return false;
    }
    // Treat vegetarian/no-meat categories as requiring dedicated meal prep.
    return /全素|蛋奶|奶蛋|素食|蔬食|不吃肉|不吃葷|vegan|vegetarian/i.test(text);
  };
  const studentByStudentId = new Map(
    displayStudents
      .map((student) => [String(student.id || "").trim(), student])
      .filter(([studentId]) => studentId)
  );
  const studentNameByStudentId = new Map(
    displayStudents
      .map((student) => [String(student.id || "").trim(), getChineseName_(student)])
      .filter(([studentId]) => studentId)
  );
  const studentByEmail = new Map(
    displayStudents.flatMap((student) => {
      const emails = [student.email, student.googleEmail]
        .map((value) => normalizeEmail_(value))
        .filter(Boolean);
      return emails.map((email) => [email, student]);
    })
  );
  const studentIdByUniqueName = (() => {
    const buckets = new Map();
    displayStudents.forEach((student) => {
      const studentId = String(student.id || "").trim();
      if (!studentId) {
        return;
      }
      [getChineseName_(student), getDisplayName_(student), student.nameZh, student.name]
        .map((value) => normalizeName_(value))
        .filter(Boolean)
        .forEach((name) => {
          const existing = buckets.get(name) || new Set();
          existing.add(studentId);
          buckets.set(name, existing);
        });
    });
    const unique = new Map();
    buckets.forEach((ids, name) => {
      if (ids.size === 1) {
        unique.set(name, Array.from(ids)[0]);
      }
    });
    return unique;
  })();
  const resolveRegistrationStudentId_ = (registration, fields = parseCustomFields_(registration && registration.customFields)) => {
    const explicitStudentId = String((registration && registration.studentId) || fields.studentId || "").trim();
    if (explicitStudentId) {
      return explicitStudentId;
    }
    const email = normalizeEmail_((registration && registration.userEmail) || fields.email || "");
    const studentByMail = email ? studentByEmail.get(email) : null;
    if (studentByMail && studentByMail.id) {
      return String(studentByMail.id || "").trim();
    }
    const name = normalizeName_(fields.name || (registration && registration.userName) || "");
    return (name && studentIdByUniqueName.get(name)) || "";
  };
  const buildRegistrationPersonKey_ = (registration, fields = parseCustomFields_(registration && registration.customFields)) => {
    const studentId = resolveRegistrationStudentId_(registration, fields);
    if (studentId) {
      return `student:${studentId}`;
    }
    const email = normalizeEmail_((registration && registration.userEmail) || fields.email || "");
    if (email) {
      return `email:${email}`;
    }
    const name = normalizeName_(fields.name || (registration && registration.userName) || "");
    if (name) {
      return `name:${name}`;
    }
    return `row:${String((registration && registration.id) || "").trim()}`;
  };
  const resolveRegistrationStudent_ = (registration, fields = parseCustomFields_(registration && registration.customFields)) => {
    const studentId = resolveRegistrationStudentId_(registration, fields);
    if (studentId && studentByStudentId.get(studentId)) {
      return studentByStudentId.get(studentId);
    }
    const email = normalizeEmail_((registration && registration.userEmail) || fields.email || "");
    return (email && studentByEmail.get(email)) || null;
  };
  const getStudentDietaryPreference_ = (student) =>
    String((student && (student.dietaryRestrictions || student.dietary)) || "").trim();
  const resolveRegistrationDietary_ = (registration, fields = parseCustomFields_(registration && registration.customFields)) => {
    const registrationDietary = String(fields.dietary || "").trim();
    if (registrationDietary) {
      return registrationDietary;
    }
    return getStudentDietaryPreference_(resolveRegistrationStudent_(registration, fields));
  };
  const studentLabelByStudentId = new Map(
    displayStudents
      .map((student) => {
        const studentId = String(student.id || "").trim();
        const chineseName = getChineseName_(student);
        const displayName = getDisplayName_(student);
        const label =
          chineseName && displayName && chineseName !== displayName
            ? `${chineseName} (${displayName})`
            : chineseName || displayName || "未命名";
        return [studentId, label];
      })
      .filter(([studentId]) => studentId)
  );
  const activeRegistrationList = registrationList.filter(
    (item) => item && String(item.status || "").toLowerCase() !== "cancelled"
  );

  // De-dupe registrations by resolved person identity (pick the latest update) to avoid inflated counts.
  const dedupedActiveRegistrations = (() => {
    const map = new Map();
    const scoreItem = (item) => {
      const fields = parseCustomFields_(item && item.customFields);
      const hasResolvedStudent = Boolean(resolveRegistrationStudentId_(item, fields));
      const created = parseTimestampValue_(item && item.createdAt);
      const updated = parseTimestampValue_(item && item.updatedAt);
      return Math.max(created, updated) + (hasResolvedStudent ? 10 ** 15 : 0);
    };

    for (const registration of activeRegistrationList) {
      const fields = parseCustomFields_(registration.customFields);
      const key = buildRegistrationPersonKey_(registration, fields);
      if (!key || key === "row:") {
        continue;
      }
      const existing = map.get(key);
      if (!existing || scoreItem(registration) >= scoreItem(existing)) {
        map.set(key, registration);
      }
    }

    return Array.from(map.values());
  })();

  const attendanceByStudentId = new Map();
  dedupedActiveRegistrations.forEach((registration) => {
    const fields = parseCustomFields_(registration.customFields);
    const attendanceValue = String(fields.attendance || "").trim();
    const studentId = resolveRegistrationStudentId_(registration, fields);
    if (studentId) {
      attendanceByStudentId.set(studentId, attendanceValue);
    }
  });

  const registeredStudentIdSet = new Set(
    dedupedActiveRegistrations
      .map((item) => {
        const fields = parseCustomFields_(item.customFields);
        return resolveRegistrationStudentId_(item, fields);
      })
      .filter((value) => value)
  );

  const totalStudents = displayStudents.length;
  const registeredCount = registeredStudentIdSet.size;
  const unregisteredCount = totalStudents
    ? Math.max(totalStudents - registeredStudentIdSet.size, 0)
    : 0;

  const attendanceCounts = Array.from(registeredStudentIdSet).reduce(
    (acc, studentId) => {
      const attendanceStatus = normalizeAttendanceStatus_(attendanceByStudentId.get(studentId));
      if (attendanceStatus === "attending") {
        acc.attending += 1;
      } else if (attendanceStatus === "not_attending") {
        acc.notAttending += 1;
      } else {
        acc.unknown += 1;
      }
      return acc;
    },
    { attending: 0, notAttending: 0, unknown: 0 }
  );

  const prepStats = dedupedActiveRegistrations.reduce(
    (acc, registration) => {
      const fields = parseCustomFields_(registration.customFields);
      const attendanceStatus = normalizeAttendanceStatus_(fields.attendance);
      if (attendanceStatus !== "attending") {
        return acc;
      }
      acc.attendingTotal += 1;

      const dietary = resolveRegistrationDietary_(registration, fields) || "未填寫";
      acc.dietary[dietary] = (acc.dietary[dietary] || 0) + 1;
      const attendeeStudentId = resolveRegistrationStudentId_(registration, fields);
      const attendeeName =
        (attendeeStudentId && studentNameByStudentId.get(attendeeStudentId)) ||
        String(fields.name || registration.userName || "").trim() ||
        "未命名";

      const parking = String(fields.parking || "").trim() || "未填寫";
      acc.parking[parking] = (acc.parking[parking] || 0) + 1;
      if (parking === "需要" || parking.toLowerCase() === "yes") {
        acc.parkingNeeded += 1;
      }

      const companions = parseInt(String(fields.companions || "0").trim(), 10);
      if (!isNaN(companions) && companions > 0) {
        acc.companionsTotal += companions;
      }

      const bringDrinks = String(fields.bringDrinks || "").trim();
      if (bringDrinks === "攜帶") {
        acc.bringDrinksCount += 1;
      }
      if (bringDrinks === "不攜帶") {
        acc.notBringDrinksCount += 1;
      }
      const drinkQtyItems = [
        { key: "redWineQty", label: "紅酒" },
        { key: "whiteWineQty", label: "白酒" },
        { key: "whiskyQty", label: "威士忌" },
        { key: "kaoliangQty", label: "高梁" },
        { key: "plumWineQty", label: "梅酒" },
        { key: "otherDrinkQty", label: String(fields.otherDrink || "其他酒水").trim() || "其他酒水" },
      ];
      const drinkItems = [];
      drinkQtyItems.forEach((item) => {
        const parsedQty = parseInt(String(fields[item.key] || "0").trim(), 10);
        if (!isNaN(parsedQty) && parsedQty > 0) {
          acc.drinks[item.key] = (acc.drinks[item.key] || 0) + parsedQty;
          drinkItems.push(`${item.label} ${parsedQty}`);
        }
      });
      const attendeeEntry = {
        name: attendeeName,
        dietary: dietary,
        parking: parking,
        travelTransportation: String(fields.travelTransportation || "").trim(),
        companions: !isNaN(companions) && companions > 0 ? companions : 0,
        bringDrinks: bringDrinks || "",
        drinkItems,
      };
      acc.attendees.push(attendeeEntry);
      if (isRegistrationTravelEvent) {
        const travelTransportation = attendeeEntry.travelTransportation || "未填寫";
        acc.travelTransportation[travelTransportation] =
          (acc.travelTransportation[travelTransportation] || 0) + 1;
      }
      if (attendeeEntry.companions > 0) {
        acc.companionAttendees.push(attendeeEntry);
      }
      if (bringDrinks === "攜帶" || drinkItems.length) {
        acc.drinkAttendees.push(attendeeEntry);
      }
      const isSpecialDietary = dietary && dietary !== "無禁忌" && dietary !== "未填寫";
      if (isSpecialDietary) {
        const entry = {
          name: attendeeName,
          dietary: dietary,
        };
        if (isVegetarianDietary_(dietary)) {
          acc.vegetarianAttendees.push(entry);
        } else {
          acc.specialDietAttendees.push(entry);
        }
      }
      return acc;
    },
    {
      attendingTotal: 0,
      parkingNeeded: 0,
      companionsTotal: 0,
      bringDrinksCount: 0,
      notBringDrinksCount: 0,
      dietary: {},
      parking: {},
      travelTransportation: {},
      drinks: {
        redWineQty: 0,
        whiteWineQty: 0,
        whiskyQty: 0,
        kaoliangQty: 0,
        plumWineQty: 0,
        otherDrinkQty: 0,
      },
      attendees: [],
      companionAttendees: [],
      drinkAttendees: [],
      vegetarianAttendees: [],
      specialDietAttendees: [],
    }
  );
  const dietaryStatsList = Object.entries(prepStats.dietary).sort((a, b) => b[1] - a[1]);
  const parkingStatsList = Object.entries(prepStats.parking).sort((a, b) => b[1] - a[1]);
  const travelTransportationStatsList = (travelTransportationField.options || [])
    .map((option) => [option, prepStats.travelTransportation[option] || 0])
    .concat(
      Object.entries(prepStats.travelTransportation)
        .filter(([label]) => !(travelTransportationField.options || []).includes(label))
        .sort((a, b) => b[1] - a[1])
    );
  const travelTransportationAttendeeGroups = travelTransportationStatsList.map(([label, count]) => ({
    label,
    count,
    attendees: prepStats.attendees
      .filter((item) => (String(item.travelTransportation || "").trim() || "未填寫") === label)
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")),
  }));
  const drinkQtyStatsList = [
    { key: "redWineQty", label: "紅酒" },
    { key: "whiteWineQty", label: "白酒" },
    { key: "whiskyQty", label: "威士忌" },
    { key: "kaoliangQty", label: "高梁" },
    { key: "plumWineQty", label: "梅酒" },
    { key: "otherDrinkQty", label: "其他酒水" },
  ]
    .map((item) => ({ ...item, qty: prepStats.drinks[item.key] || 0 }))
    .filter((item) => item.qty > 0);
  const companionAttendeeList = (prepStats.companionAttendees || []).slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
  );
  const drinkAttendeeList = (prepStats.drinkAttendees || []).slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
  );
  const vegetarianAttendeeList = (prepStats.vegetarianAttendees || []).slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
  );
  const vegetarianAttendeeGroups = vegetarianAttendeeList.reduce((acc, item) => {
    const key = String(item.dietary || "其他").trim() || "其他";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item.name || "未命名");
    return acc;
  }, {});
  const vegetarianAttendeeGroupList = Object.entries(vegetarianAttendeeGroups).sort((a, b) =>
    String(a[0] || "").localeCompare(String(b[0] || ""), "zh-Hant")
  );

  const specialDietAttendeeList = (prepStats.specialDietAttendees || []).slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
  );
  const specialDietAttendeeGroups = specialDietAttendeeList.reduce((acc, item) => {
    const key = String(item.dietary || "其他").trim() || "其他";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item.name || "未命名");
    return acc;
  }, {});
  const specialDietAttendeeGroupList = Object.entries(specialDietAttendeeGroups).sort((a, b) =>
    String(a[0] || "").localeCompare(String(b[0] || ""), "zh-Hant")
  );
  const attendingNameList = prepStats.attendees.slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
  );
  const attendingRegistrationExportRows = dedupedActiveRegistrations
    .map((registration) => {
      const fields = parseCustomFields_(registration.customFields);
      if (normalizeAttendanceStatus_(fields.attendance) !== "attending") {
        return null;
      }
      const studentId = resolveRegistrationStudentId_(registration, fields);
      const student = (studentId && studentByStudentId.get(studentId)) || null;
      const name =
        getChineseName_(student) ||
        String(fields.name || registration.userName || "").trim() ||
        "未命名";
      const companions = parseInt(String(fields.companions || "0").trim(), 10);
      return {
        name,
        studentId,
        group: String((student && student.group) || "").trim(),
        travelTransportation: String(fields.travelTransportation || "").trim(),
        dietary: resolveRegistrationDietary_(registration, fields),
        parking: String(fields.parking || "").trim(),
        companions: !isNaN(companions) && companions > 0 ? companions : 0,
        bringDrinks: String(fields.bringDrinks || "").trim(),
        redWineQty: String(fields.redWineQty || "").trim(),
        whiteWineQty: String(fields.whiteWineQty || "").trim(),
        whiskyQty: String(fields.whiskyQty || "").trim(),
        kaoliangQty: String(fields.kaoliangQty || "").trim(),
        plumWineQty: String(fields.plumWineQty || "").trim(),
        otherDrink: String(fields.otherDrink || "").trim(),
        otherDrinkQty: String(fields.otherDrinkQty || "").trim(),
        proxy: String(fields.proxy || "").trim(),
        projection: String(fields.projection || "").trim(),
        topics: String(fields.topics || "").trim(),
        notes: String(fields.notes || fields.note || "").trim(),
        submittedAt: registration.createdAt || "",
        updatedAt: registration.updatedAt || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant"));
  const manualRegistrationEntries = registrationList
    .map((registration) => {
      const fields = parseCustomFields_(registration.customFields);
      const meta =
        fields && typeof fields._manualRegistration === "object" ? fields._manualRegistration : {};
      const actorEmail = String(registration.manualCreatedBy || meta.actorEmail || "").trim();
      const actorName = String(registration.manualCreatedByName || meta.actorName || "").trim();
      const createdAt = registration.manualCreatedAt || meta.at || "";
      if (!actorEmail && !createdAt) {
        return null;
      }
      const studentId = String(registration.studentId || fields.studentId || "").trim();
      return {
        id: String(registration.id || "").trim(),
        userName: String(registration.userName || fields.name || "未命名").trim(),
        studentId: studentId,
        actorEmail: actorEmail,
        actorName: actorName,
        createdAt: createdAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => parseTimestampValue_(b.createdAt) - parseTimestampValue_(a.createdAt))
    .slice(0, 10);

  const buildRegistrationStatsCsv_ = () => {
    const eventTitle = String((selectedRegistrationEvent && selectedRegistrationEvent.title) || "").trim();
    const eventId = String((selectedRegistrationEvent && selectedRegistrationEvent.id) || registrationEventId || "").trim();
    const rows = [];
    const pushRow_ = (values) =>
      rows.push(
        values
          .map((value) => {
            const raw = String(value == null ? "" : value);
            if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
              return `"${raw.replace(/"/g, "\"\"")}"`;
            }
            return raw;
          })
          .join(",")
      );

    pushRow_(["活動名稱", eventTitle || "-"]);
    pushRow_(["活動ID", eventId || "-"]);
    pushRow_(["匯出時間", new Date().toLocaleString()]);
    pushRow_([]);

    pushRow_(["摘要", "數值"]);
    pushRow_(["出席人數", prepStats.attendingTotal]);
    if (isRegistrationTravelEvent) {
      travelTransportationStatsList.forEach(([label, count]) => {
        pushRow_([`交通方式：${label}`, count]);
      });
    }
    pushRow_(["停車位需求", prepStats.parkingNeeded]);
    if (registrationAllowCompanions) {
      pushRow_(["攜伴總人數", prepStats.companionsTotal]);
    }
    if (registrationAllowBringDrinks) {
      pushRow_(["自帶酒水（人）", prepStats.bringDrinksCount]);
      pushRow_(["不攜帶酒水（人）", prepStats.notBringDrinksCount]);
    }
    pushRow_([]);

    if (isRegistrationTravelEvent) {
      pushRow_(["旅遊交通方式", "人數"]);
      travelTransportationStatsList.forEach(([label, count]) => pushRow_([label, count]));
      pushRow_([]);
    }

    pushRow_(["飲食偏好", "人數"]);
    if (dietaryStatsList.length) {
      dietaryStatsList.forEach(([label, count]) => pushRow_([label, count]));
    } else {
      pushRow_(["(無資料)", 0]);
    }
    pushRow_([]);

    pushRow_(["停車偏好", "人數"]);
    if (parkingStatsList.length) {
      parkingStatsList.forEach(([label, count]) => pushRow_([label, count]));
    } else {
      pushRow_(["(無資料)", 0]);
    }
    pushRow_([]);

    if (registrationAllowBringDrinks) {
      pushRow_(["酒水品項", "數量"]);
      if (drinkQtyStatsList.length) {
        drinkQtyStatsList.forEach((item) => pushRow_([item.label, item.qty]));
      } else {
        pushRow_(["(無資料)", 0]);
      }
      pushRow_([]);
    }

    pushRow_(
      isRegistrationTravelEvent
        ? ["出席名單", "交通方式", "飲食偏好", "停車", "攜伴", "自帶酒水"]
        : ["出席名單", "飲食偏好", "停車", "攜伴", "自帶酒水"]
    );
    if (attendingNameList.length) {
      attendingNameList.forEach((item) =>
        pushRow_(
          isRegistrationTravelEvent
            ? [
                item.name,
                item.travelTransportation || "-",
                item.dietary || "-",
                item.parking || "-",
                item.companions || 0,
                item.bringDrinks || "-",
              ]
            : [
                item.name,
                item.dietary || "-",
                item.parking || "-",
                item.companions || 0,
                item.bringDrinks || "-",
              ]
        )
      );
    } else {
      pushRow_(isRegistrationTravelEvent ? ["(無資料)", "", "", "", "", ""] : ["(無資料)", "", "", "", ""]);
    }
    pushRow_([]);

    pushRow_(["素食/不吃肉名單", "飲食偏好"]);
    if (vegetarianAttendeeList.length) {
      vegetarianAttendeeList.forEach((item) => pushRow_([item.name, item.dietary]));
    } else {
      pushRow_(["(無資料)", ""]);
    }
    pushRow_([]);

    pushRow_(["其他特殊飲食/過敏名單", "飲食偏好"]);
    if (specialDietAttendeeList.length) {
      specialDietAttendeeList.forEach((item) => pushRow_([item.name, item.dietary]));
    } else {
      pushRow_(["(無資料)", ""]);
    }
    return rows.join("\n");
  };

  const handleExportRegistrationStats = () => {
    if (typeof window === "undefined" || !registrationEventId) {
      return;
    }
    const csv = buildRegistrationStatsCsv_();
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeEventId = String(registrationEventId || "event").trim() || "event";
    link.href = url;
    link.download = `registration-stats-${safeEventId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const buildAttendanceExcelRows_ = () => {
    const eventTitle = String((selectedRegistrationEvent && selectedRegistrationEvent.title) || "").trim();
    const eventId = String((selectedRegistrationEvent && selectedRegistrationEvent.id) || registrationEventId || "").trim();
    const headers = [
      "序號",
      "姓名",
      "學號",
      "組別",
      ...(isRegistrationTravelEvent ? ["交通方式"] : []),
      "飲食偏好",
      "停車",
      "攜伴人數",
      "自帶酒水",
      "紅酒",
      "白酒",
      "威士忌",
      "高梁",
      "梅酒",
      "其他酒水",
      "其他酒水數量",
      "代理出席",
      "投影設備",
      "議題/提案",
      "備註",
      "報名時間",
      "更新時間",
    ];
    const rows = [
      ["活動名稱", eventTitle || "-"],
      ["活動ID", eventId || "-"],
      ["匯出時間", new Date().toLocaleString()],
      ["出席人數", attendingRegistrationExportRows.length],
      [],
      headers,
    ];

    if (attendingRegistrationExportRows.length) {
      attendingRegistrationExportRows.forEach((item, index) => {
        rows.push([
          index + 1,
          item.name,
          item.studentId,
          item.group,
          ...(isRegistrationTravelEvent ? [item.travelTransportation] : []),
          item.dietary,
          item.parking,
          item.companions,
          item.bringDrinks,
          item.redWineQty,
          item.whiteWineQty,
          item.whiskyQty,
          item.kaoliangQty,
          item.plumWineQty,
          item.otherDrink,
          item.otherDrinkQty,
          item.proxy,
          item.projection,
          item.topics,
          item.notes,
          item.submittedAt,
          item.updatedAt,
        ]);
      });
    } else {
      rows.push(["", "(無出席資料)"]);
    }
    return rows;
  };

  const buildSafeFilename_ = (value, fallback = "出席名單") =>
    String(value || fallback)
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/-+/g, "-")
      .replace(/^[\s.-]+|[\s.-]+$/g, "") || fallback;

  const handleExportAttendanceExcel = () => {
    if (typeof window === "undefined" || !registrationEventId) {
      return;
    }
    const eventTitle = String((selectedRegistrationEvent && selectedRegistrationEvent.title) || "活動").trim();
    const safeEventTitle = buildSafeFilename_(eventTitle || "活動", "活動");
    downloadXlsx({
      filename: `${safeEventTitle}-出席名單.xlsx`,
      sheetName: eventTitle || "出席名單",
      rows: buildAttendanceExcelRows_(),
    });
  };

  const directoryGroupOptions = useMemo(() => {
    const map = {};
    directory.forEach((item) => {
      const groupId = String(item.group || "").trim();
      if (groupId) {
        map[groupId] = true;
      }
    });
    return Object.keys(map).sort((a, b) => a.localeCompare(b, "zh-Hant", { numeric: true }));
  }, [directory]);

  const filteredDirectoryStudents = useMemo(
    () =>
      directory.filter((item) => {
        const groupMatch =
          studentsGroupFilter === "all" ? true : String(item.group || "").trim() === studentsGroupFilter;
        return groupMatch && matchesStudentQuery_(item, studentsQuery);
      }),
    [directory, studentsGroupFilter, studentsQuery]
  );

  const sortedDirectoryStudents = useMemo(() => {
    const list = filteredDirectoryStudents.slice();
    list.sort((a, b) => {
      const left = getDirectorySortValue_(a, studentsSortKey);
      const right = getDirectorySortValue_(b, studentsSortKey);
      const cmp = String(left).localeCompare(String(right), "zh-Hant", {
        numeric: true,
        sensitivity: "base",
      });
      return studentsSortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filteredDirectoryStudents, studentsSortDir, studentsSortKey]);

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

  const proxyOrderResponses = orderResponses.filter(
    (item) => String(item.sourceType || "").trim() === "proxy_external"
  );
  const draftOrderPlan = isCreatingOrder
    ? {
        id: "__draft__",
        date: orderForm.date,
        title: orderForm.title || "新的訂餐日期",
        status: "draft",
        isDraft: true,
      }
    : null;
  const displayOrderPlans = draftOrderPlan ? [draftOrderPlan, ...orderPlans] : orderPlans;
  const activeOrderPlan = isCreatingOrder
    ? draftOrderPlan
    : orderPlans.find((plan) => normalizeOrderId_(plan.id) === normalizeOrderId_(orderActiveId)) || null;
  const activeOrderLabel = activeOrderPlan
    ? `${formatOrderDateLabel_(activeOrderPlan.date)}${activeOrderPlan.title ? ` · ${activeOrderPlan.title}` : ""}`
    : "";
  const canRestoreActiveOrder = Boolean(activeOrderPlan && !activeOrderPlan.isDraft) && orderResponses.length === 0;
  const orderRestoreBlockedReason = "這個訂餐已有同學回覆，不能直接回復舊版。";
  const runtimeOrigin = typeof window !== "undefined" ? String(window.location.origin || "").trim() : "";
  const publicSiteBase = String(PUBLIC_SITE_URL || runtimeOrigin || "").replace(/\/$/, "");
  const publicOrderUrl = publicOrderLinkForm.token
    ? `${publicSiteBase}/ordering-public?token=${encodeURIComponent(publicOrderLinkForm.token)}`
    : "";
  const isOrderPickedUp_ = (item) => Boolean(String((item && item.pickedUpAt) || "").trim());
  const orderStats = orderResponses.reduce(
    (acc, item) => {
      const choice = String(item.choice || "").toUpperCase();
      const pickedUp = isOrderPickedUp_(item);
      if (choice === "A") {
        acc.A += 1;
      } else if (choice === "B") {
        acc.B += 1;
      } else if (choice === "C") {
        acc.C += 1;
      } else if (choice === "VEG") {
        acc.VEG += 1;
      } else {
        acc.NONE += 1;
      }
      if (pickedUp) {
        acc.picked += 1;
      } else if (choice !== "NONE") {
        acc.unpicked += 1;
      }
      if (String(item.sourceType || "").trim() === "proxy_external") {
        acc.proxy += 1;
      }
      if (String(item.sourceType || "").trim() === "public_external") {
        acc.public += 1;
      }
      acc.total += 1;
      return acc;
    },
    { A: 0, B: 0, C: 0, VEG: 0, NONE: 0, total: 0, proxy: 0, public: 0, picked: 0, unpicked: 0 }
  );

  const getOrderChoiceLabel_ = (choice) => {
    const normalized = String(choice || "").trim().toUpperCase();
    if (normalized === "A") {
      return orderForm.optionA || "A 餐";
    }
    if (normalized === "B") {
      return orderForm.optionB || "B 餐";
    }
    if (normalized === "C") {
      return orderForm.optionC || (hasOrderVegetarianChoice_(orderForm) ? "C 餐" : "素食餐");
    }
    if (normalized === "VEG") {
      return orderForm.optionVegetarian || "素食餐";
    }
    if (normalized === "NONE") {
      return "不吃";
    }
    return normalized || "-";
  };

  const escapeHtml_ = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const buildOrderReportHtml_ = () => {
    const reportTitle = activeOrderLabel || "訂餐報表";
    const generatedAt = new Date().toLocaleString();
    const sections = groupedOrderResponses
      .map((group) => {
        const rows = group.items
          .map((item, index) => {
            return `
              <tr>
                <td>${escapeHtml_(getOrderAttendeeLabel_(item))}</td>
                <td>${escapeHtml_(String(item.comment || "").trim() || "")}</td>
                <td class="check-cell">□</td>
              </tr>
            `;
          })
          .join("");

        return `
          <section class="meal-block">
            <h2>${escapeHtml_(group.label)}（${group.items.length}）</h2>
            ${
              group.items.length
                ? `<table>
                    <thead>
                      <tr>
                        <th>姓名</th>
                        <th>備註</th>
                        <th>勾選</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>`
                : `<p class="empty">此餐別目前無資料。</p>`
            }
          </section>
        `;
      })
      .join("");

    return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml_(reportTitle)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Noto Sans TC", sans-serif; color: #0f172a; margin: 24px; }
      h1 { margin: 0 0 8px; font-size: 24px; }
      .meta { color: #475569; font-size: 12px; margin-bottom: 16px; }
      .meal-block { margin-top: 16px; page-break-inside: avoid; }
      .meal-block h2 { margin: 0 0 8px; font-size: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; }
      .check-cell { text-align: center; font-size: 16px; font-weight: 700; width: 64px; }
      .empty { color: #64748b; font-size: 12px; margin: 0; }
      @media print {
        body { margin: 12mm; }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml_(reportTitle)}</h1>
    <div class="meta">匯出時間：${escapeHtml_(generatedAt)}</div>
    ${sections}
  </body>
</html>`;
  };

  const handleExportOrderReportPdf = () => {
    if (typeof window === "undefined") {
      return;
    }
    if (!activeSavedOrderId) {
      setOrderStatusMessage("請先選擇已儲存的訂餐日期");
      return;
    }
    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) {
      setOrderStatusMessage("無法開啟列印視窗，請確認瀏覽器未封鎖彈出視窗");
      return;
    }
    const html = buildOrderReportHtml_().replace(
      "</body>",
      `<script>
        (function () {
          var trigger = function () {
            try { window.focus(); } catch (e) {}
            setTimeout(function () {
              try { window.print(); } catch (e) {}
            }, 350);
          };
          if (document.readyState === "complete") {
            trigger();
          } else {
            window.addEventListener("load", trigger, { once: true });
          }
        })();
      </script></body>`
    );
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const getOrderAttendeeLabel_ = (item) => {
    const isProxy = String((item && item.sourceType) || "").trim() === "proxy_external";
    const studentId = String((item && item.studentId) || "").trim();
    const canonicalZh = String((item && item.nameZh) || "").trim();
    const canonicalDisplay = String((item && item.displayName) || "").trim();
    const canonicalLabel =
      canonicalZh && canonicalDisplay && canonicalZh !== canonicalDisplay
        ? `${canonicalZh} (${canonicalDisplay})`
        : canonicalZh || canonicalDisplay || "";
    return (
      (!isProxy && studentId && studentLabelByStudentId.get(studentId)) ||
      canonicalLabel ||
      String((item && item.studentName) || "").trim() ||
      "未命名"
    );
  };

  const orderComments = orderResponses
    .map((item) => ({
      id: String(item.id || "").trim(),
      label: getOrderAttendeeLabel_(item),
      comment: String(item.comment || "").trim(),
      isProxy: String(item.sourceType || "").trim() === "proxy_external",
      sourceLabel: String(item.sourceLabel || "").trim(),
    }))
    .filter((item) => item.comment);

  const sortOrderRosterItems_ = (items) =>
    [...items].sort((a, b) => {
      const aProxy = String(a.sourceType || "").trim() === "proxy_external" ? 1 : 0;
      const bProxy = String(b.sourceType || "").trim() === "proxy_external" ? 1 : 0;
      if (aProxy !== bProxy) {
        return aProxy - bProxy;
      }
      return getOrderAttendeeLabel_(a).localeCompare(getOrderAttendeeLabel_(b), "zh-Hant", {
        numeric: true,
        sensitivity: "base",
      });
    });

  const orderRosterNeedle = String(orderRosterQuery || "").trim().toLowerCase();
  const matchesOrderRosterFilter_ = (item) => {
    if (!orderRosterNeedle) {
      return true;
    }
    const haystack = [
      getOrderAttendeeLabel_(item),
      String((item && item.studentId) || ""),
      String((item && item.sourceLabel) || ""),
      String((item && item.comment) || ""),
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(orderRosterNeedle);
  };
  const matchesStudentRosterFilter_ = (student) => {
    if (!orderRosterNeedle) {
      return true;
    }
    const studentId = String((student && student.id) || "").trim();
    const haystack = [
      studentLabelByStudentId.get(studentId),
      getChineseName_(student),
      getDisplayName_(student),
      studentId,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(orderRosterNeedle);
  };
  const activeSavedOrderId = normalizeOrderId_(orderForm.id || orderActiveId);
  const submittedOrderStudentIds = new Set(
    orderResponses
      .filter((item) => String((item && item.sourceType) || "").trim() !== "proxy_external")
      .map((item) => String((item && item.studentId) || "").trim())
      .filter(Boolean)
  );
  const unsubmittedOrderStudents = activeSavedOrderId
    ? sortOrderRosterItems_(
        displayStudents.filter((student) => {
          const studentId = String((student && student.id) || "").trim();
          if (!studentId) {
            return false;
          }
          if (submittedOrderStudentIds.has(studentId)) {
            return false;
          }
          return matchesStudentRosterFilter_(student);
        })
      )
    : [];

  const groupedOrderResponses = [
    { key: "A", label: orderForm.optionA || "A 餐", items: sortOrderRosterItems_(orderResponses.filter((item) => String(item.choice || "").toUpperCase() === "A")) },
    { key: "B", label: orderForm.optionB || "B 餐", items: sortOrderRosterItems_(orderResponses.filter((item) => String(item.choice || "").toUpperCase() === "B")) },
    { key: "C", label: orderForm.optionC || (hasOrderVegetarianChoice_(orderForm) ? "C 餐" : "素食餐"), items: sortOrderRosterItems_(orderResponses.filter((item) => String(item.choice || "").toUpperCase() === "C")) },
    ...(hasOrderVegetarianChoice_(orderForm)
      ? [{ key: "VEG", label: orderForm.optionVegetarian || "素食餐", items: sortOrderRosterItems_(orderResponses.filter((item) => String(item.choice || "").toUpperCase() === "VEG")) }]
      : []),
    { key: "NONE", label: "不吃", items: sortOrderRosterItems_(orderResponses.filter((item) => String(item.choice || "").toUpperCase() === "NONE")) },
  ].map((group) => {
    const filteredItems = group.items.filter((item) => matchesOrderRosterFilter_(item));
    const unpickedItems = filteredItems.filter((item) => !isOrderPickedUp_(item));
    const pickedItems = filteredItems.filter((item) => isOrderPickedUp_(item));
    return {
      ...group,
      filteredItems,
      unpickedItems,
      pickedItems,
    };
  });

  const visibleGroupedOrderResponses = groupedOrderResponses.filter(
    (group) => orderMealFocus === "ALL" || group.key === orderMealFocus
  );

  const displayStudentById = new Map(
    displayStudents
      .map((student) => [String(student.id || "").trim(), student])
      .filter(([studentId]) => studentId)
  );

  const dietaryBaseStudents = displayStudents.length ? displayStudents : students;
  const dietaryPreferenceRows = dietaryBaseStudents
    .map((student) => {
      const studentId = String(student.id || "").trim();
      const mergedStudent = displayStudentById.get(studentId) || student;
      const dietaryRaw = String(
        student.dietaryRestrictions || mergedStudent.dietaryRestrictions || ""
      ).trim();
      const dietaryLabel = dietaryRaw || "未填寫";
      const displayName =
        getChineseName_(mergedStudent) || getDisplayName_(mergedStudent) || studentId || "未命名";
      return {
        id: studentId,
        name: displayName,
        dietaryRaw,
        dietaryLabel,
        isVegetarian: isVegetarianDietary_(dietaryRaw),
        isNoRestriction: dietaryRaw === "無禁忌",
        isUnspecified: !dietaryRaw,
      };
    })
    .filter((item) => item.id || item.name)
    .sort((a, b) =>
      String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""), "zh-Hant", {
        numeric: true,
        sensitivity: "base",
      })
    );

  const dietaryFilteredRows = dietaryPreferenceRows.filter((item) => {
    const needle = String(dietaryQuery || "").trim().toLowerCase();
    if (!needle) {
      return true;
    }
    const haystack = [item.id, item.name, item.dietaryRaw, item.dietaryLabel]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(needle);
  });

  const dietaryNoRestrictionList = dietaryFilteredRows.filter((item) => item.isNoRestriction);
  const dietaryVegetarianList = dietaryFilteredRows.filter((item) => item.isVegetarian);
  const dietarySpecialList = dietaryFilteredRows.filter(
    (item) => !item.isNoRestriction && !item.isVegetarian && !item.isUnspecified
  );
  const dietaryUnspecifiedList = dietaryFilteredRows.filter((item) => item.isUnspecified);

  const groupDietaryRowsByLabel_ = (list) =>
    Object.entries(
      list.reduce((acc, item) => {
        const key = String(item.dietaryLabel || "其他").trim() || "其他";
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      }, {})
    ).sort((a, b) => a[0].localeCompare(b[0], "zh-Hant", { numeric: true, sensitivity: "base" }));

  const dietaryVegetarianGroups = groupDietaryRowsByLabel_(dietaryVegetarianList);
  const dietarySpecialGroups = groupDietaryRowsByLabel_(dietarySpecialList);

  const buildDietaryPreferenceCsv_ = () => {
    const rows = [];
    const pushRow_ = (values) =>
      rows.push(
        values
          .map((value) => {
            const raw = String(value == null ? "" : value);
            if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
              return `"${raw.replace(/"/g, '""')}"`;
            }
            return raw;
          })
          .join(",")
      );

    pushRow_(["頁面", "餐食喜好"]);
    pushRow_(["匯出時間", new Date().toLocaleString()]);
    pushRow_(["範圍", "全部同學"]);
    pushRow_(["搜尋條件", String(dietaryQuery || "").trim() || "(無)"]);
    pushRow_([]);
    pushRow_(["分類", "中文姓名", "學號", "飲食偏好"]);

    const appendCategoryRows_ = (label, list) => {
      if (list.length) {
        list.forEach((item) => pushRow_([label, item.name || "-", item.id || "-", item.dietaryLabel || "-"]));
      } else {
        pushRow_([label, "(無資料)", "", ""]);
      }
    };

    appendCategoryRows_("無禁忌", dietaryNoRestrictionList);
    appendCategoryRows_("素食/蔬食", dietaryVegetarianList);
    appendCategoryRows_("其他特殊飲食", dietarySpecialList);
    appendCategoryRows_("未填寫", dietaryUnspecifiedList);
    return rows.join("\n");
  };

  const handleExportDietaryPreferenceCsv = () => {
    if (typeof window === "undefined") {
      return;
    }
    const csv = buildDietaryPreferenceCsv_();
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dietary-preferences-all-students.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const pendingCheckins = checkinEventId
    ? (registrationsByEvent[normalizeEventId_(checkinEventId)] || []).filter((registration) => {
        if (!registration || String(registration.status || "").toLowerCase() === "cancelled") {
          return false;
        }
        const attendanceStatus = normalizeAttendanceStatus_(
          parseCustomFields_(registration.customFields).attendance
        );
        if (attendanceStatus !== "attending") {
          return false;
        }
        const registrationId = String(registration.id || "").trim();
        return registrationId && !checkinRegistrationSet.has(registrationId);
      })
    : [];
  const checkinRegistrations = checkinEventId
    ? (registrationsByEvent[normalizeEventId_(checkinEventId)] || []).filter((registration) => {
        if (!registration || String(registration.status || "").toLowerCase() === "cancelled") {
          return false;
        }
        const attendanceStatus = normalizeAttendanceStatus_(
          parseCustomFields_(registration.customFields).attendance
        );
        if (attendanceStatus !== "attending") {
          return false;
        }
        return Boolean(String(registration.id || "").trim());
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
              {pageTitle}
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
              { id: "dietary", label: "餐食喜好" },
              { id: "registrations", label: "報名" },
              { id: "checkins", label: "簽到" },
              { id: "students", label: "通訊錄" },
              { id: "roles", label: "班務分組" },
              { id: "quickLinks", label: "常用鏈結" },
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
                : activeTab === "dietary"
                ? "餐食喜好"
                : activeTab === "registrations"
                ? "報名名單"
                : activeTab === "checkins"
                ? "簽到名單"
                : activeTab === "students"
                ? "通訊錄"
                : activeTab === "roles"
                ? "班務分組"
                : "常用鏈結"}
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
              <div className="flex items-end justify-between gap-3">
                <div className="grid flex-1 gap-2 text-sm">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    選擇活動
                  </label>
                  <select
                    value={eventListId}
                    onChange={(event) => handleSelectEventForEdit(event.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    {sortedEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                        {isEventClosed_(event) ? " (已結束)" : ""} · {event.id}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleStartCreateEvent}
                  className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  新增活動
                </button>
              </div>
              {selectedEventForList ? (
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {selectedEventForList.title}
                        {isEventClosed_(selectedEventForList) ? " (已結束)" : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDisplayDate_(selectedEventForList.startAt, { withTime: true }) || "-"} ·{" "}
                        {selectedEventForList.location || "-"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedEventForList.id || "-"}
                      </p>
                    </div>
                    <details className="relative">
                      <summary className="cursor-pointer list-none rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300">
                        ⋯
                      </summary>
                      <div className="absolute right-0 z-10 mt-2 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => handleDelete(selectedEventForList.id)}
                          disabled={saving}
                          className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        >
                          刪除活動
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">目前沒有活動資料。</p>
              )}
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
                    {displayOrderPlans.length ? (
                      displayOrderPlans.map((plan) => {
                        const isDraft = Boolean(plan.isDraft);
                        const isActive = isDraft
                          ? isCreatingOrder && !orderForm.id
                          : normalizeOrderId_(orderActiveId) === normalizeOrderId_(plan.id);
                        const isClosed = !isDraft && isOrderPlanClosedForAdmin_(plan);
                        return (
                          <button
                            key={plan.id}
                            onClick={() => {
                              if (isDraft) {
                                handleOrderReset();
                                return;
                              }
                              setIsCreatingOrder(false);
                              setOrderActiveId(normalizeOrderId_(plan.id));
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                              isActive
                                ? "border-slate-900 bg-slate-900 text-white"
                                : isDraft
                                  ? "border-dashed border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <div>
                              <p className="font-semibold">{isDraft ? "＋ 未儲存的新訂餐" : formatOrderDateLabel_(plan.date)}</p>
                              <p className="text-xs opacity-70">
                                {isDraft ? "先填日期與餐點後儲存" : `${plan.title || "訂餐"} · ${plan.status || "open"}`}
                              </p>
                            </div>
                            {isClosed ? (
                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  isActive
                                    ? "bg-white/15 text-white"
                                    : "border border-amber-200 bg-amber-50 text-amber-700"
                                }`}
                              >
                                已截止
                              </span>
                            ) : null}
                          </button>
                        );
                      })
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
                  <div className="grid gap-3 sm:grid-cols-4">
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
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">選項 C</label>
                      <input
                        value={orderForm.optionC}
                        onChange={(event) => handleOrderFormChange("optionC", event.target.value)}
                        className="input-sm"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">素食</label>
                      <input
                        value={orderForm.optionVegetarian}
                        onChange={(event) => handleOrderFormChange("optionVegetarian", event.target.value)}
                        className="input-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
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
                    <div
                      className="grid gap-2"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleOrderImageDrop("optionCImage", event)}
                    >
                      <label className="text-sm font-medium text-slate-700">C 餐圖片</label>
                      <input
                        value={orderForm.optionCImage}
                        onChange={(event) =>
                          handleOrderFormChange("optionCImage", event.target.value)
                        }
                        placeholder="貼上圖片網址或拖曳圖片"
                        className="input-sm"
                      />
                      <p className="text-xs text-slate-400">請貼上圖片網址（https://...）</p>
                      {orderForm.optionCImage ? (
                        <img
                          src={orderForm.optionCImage}
                          alt="C 餐"
                          className="h-28 w-full rounded-2xl border border-slate-200 object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div
                      className="grid gap-2"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleOrderImageDrop("optionVegetarianImage", event)}
                    >
                      <label className="text-sm font-medium text-slate-700">素食餐圖片</label>
                      <input
                        value={orderForm.optionVegetarianImage}
                        onChange={(event) =>
                          handleOrderFormChange("optionVegetarianImage", event.target.value)
                        }
                        placeholder="貼上圖片網址或拖曳圖片"
                        className="input-sm"
                      />
                      <p className="text-xs text-slate-400">請貼上圖片網址（https://...）</p>
                      {orderForm.optionVegetarianImage ? (
                        <img
                          src={orderForm.optionVegetarianImage}
                          alt="素食餐"
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
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleDeleteOrderPlan}
                      className="rounded-xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300 disabled:opacity-60"
                    >
                      {orderForm.id ? "刪除訂餐日期" : "取消新增"}
                    </button>
                    {orderForm.id ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                        revision {Number(orderForm.revisionNo || 0) || 0}
                      </span>
                    ) : null}
                    {orderStatusMessage ? (
                      <span className="text-xs font-semibold text-amber-600">
                        {orderStatusMessage}
                      </span>
                    ) : null}
                  </div>
                </form>
              </div>

              <details className="order-last rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-xl px-1 py-1 text-slate-700 marker:hidden">
                  <span>
                    <span className="font-semibold text-slate-900">異動紀錄</span>
                    <span className="ml-2 text-slate-400">備查用，預設收合</span>
                  </span>
                  <span className="text-slate-400">
                    {orderAuditEvents.length ? `${orderAuditEvents.length} 筆` : activeOrderLabel ? activeOrderLabel : "請先選擇訂餐日期"} · 展開
                  </span>
                </summary>
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {orderAuditLoading ? (
                    <p className="text-slate-400">載入中...</p>
                  ) : orderAuditEvents.length ? (
                    orderAuditEvents.map((item) => {
                      const diffEntries = buildAuditDiffEntries_(item.diff || {});
                      const hiddenSystemFieldCount = Math.max(
                        0,
                        Object.entries(item.diff || {}).length - diffEntries.length
                      );
                      const summaryLabel = buildAuditSummary_(item, diffEntries);
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-800">{summaryLabel}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                                  {formatAuditEntityLabel_(item.entityType)}
                                </span>
                                {item.revisionNo ? (
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                    r{item.revisionNo}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                <span>{item.actorName || item.actorId || 'system'}</span>
                                {item.action ? <span>· {formatAuditActionLabel_(item.action)}</span> : null}
                                <span>· {formatDisplayDate_(item.createdAt, { withTime: true }) || item.createdAt}</span>
                              </div>
                              {diffEntries.length ? (
                                <div className="mt-2 space-y-1">
                                  {diffEntries.slice(0, 6).map(([key, value]) => (
                                    <div key={key} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
                                      <span className="font-semibold text-slate-700">{formatAuditFieldLabel_(key)}</span>
                                      <span className="mx-1 text-slate-400">:</span>
                                      <span className="text-rose-600">{formatAuditValue_(key, value && value.before)}</span>
                                      <span className="mx-1 text-slate-400">→</span>
                                      <span className="text-emerald-700">{formatAuditValue_(key, value && value.after)}</span>
                                    </div>
                                  ))}
                                  {diffEntries.length > 6 ? <p className="text-[11px] text-slate-400">還有 {diffEntries.length - 6} 個欄位變更</p> : null}
                                </div>
                              ) : hiddenSystemFieldCount ? (
                                <p className="mt-2 text-[11px] text-slate-400">這次只有系統版本資訊變更，沒有訂餐內容欄位差異。</p>
                              ) : null}
                            </div>
                            {item.versionId ? (
                              <button
                                type="button"
                                disabled={saving || !canRestoreActiveOrder || item.canRestoreVersion === false}
                                onClick={() => handleRestoreOrderAuditVersion(item)}
                                title={
                                  !canRestoreActiveOrder
                                    ? orderRestoreBlockedReason
                                    : item.restoreBlockedReason || ""
                                }
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {canRestoreActiveOrder && item.canRestoreVersion !== false
                                  ? "回復到這版"
                                  : "已有回覆不可回復"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-slate-400">目前沒有異動紀錄。</p>
                  )}
                </div>
              </details>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">手動代訂</p>
                    <p className="mt-1 text-xs text-slate-500">給不在班級正式名單內、但需要一起訂餐的人使用。</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {activeOrderLabel ? `目前套用 ${activeOrderLabel}` : "請先選擇訂餐日期"}
                  </span>
                </div>
                <form onSubmit={handleProxyOrderSubmit} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_120px]">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">姓名</label>
                    <input
                      value={proxyOrderForm.displayName}
                      onChange={(event) =>
                        setProxyOrderForm((prev) => ({ ...prev, displayName: event.target.value }))
                      }
                      placeholder="例如：王小美"
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">來源 / 身份</label>
                    <input
                      value={proxyOrderForm.sourceLabel}
                      onChange={(event) =>
                        setProxyOrderForm((prev) => ({ ...prev, sourceLabel: event.target.value }))
                      }
                      placeholder="例如：他班修課同學"
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">餐點</label>
                    <select
                      value={proxyOrderForm.choice}
                      onChange={(event) =>
                        setProxyOrderForm((prev) => ({ ...prev, choice: event.target.value }))
                      }
                      className="input-sm"
                    >
                      {getOrderChoiceOptions_(orderForm).map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2 lg:col-span-2">
                    <label className="text-sm font-medium text-slate-700">備註</label>
                    <input
                      value={proxyOrderForm.comment}
                      onChange={(event) =>
                        setProxyOrderForm((prev) => ({ ...prev, comment: event.target.value }))
                      }
                      placeholder="例如：幫外部修課同學代訂、會後現場付"
                      className="input-sm"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="submit" disabled={saving || !orderActiveId} className="btn-primary flex-1">
                      {saving ? "儲存中..." : proxyOrderForm.id ? "更新代訂" : "新增代訂"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProxyOrderForm(buildDefaultProxyOrderForm())}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      清空
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">外部訂餐連結</p>
                    <p className="mt-1 text-xs text-slate-500">給沒有 115B 帳號的同學 / 學長姐掃 QR Code 或點連結自助訂餐。</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {activeOrderLabel ? `目前套用 ${activeOrderLabel}` : "請先選擇訂餐日期"}
                  </span>
                </div>
                <form onSubmit={handleSaveOrderPublicLink} className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="grid gap-2 lg:col-span-2">
                    <label className="text-sm font-medium text-slate-700">狀態</label>
                    <select
                      value={publicOrderLinkForm.status}
                      onChange={(event) => {
                        publicOrderLinkDraftTouchedRef.current = true;
                        setPublicOrderLinkForm((prev) => ({ ...prev, status: event.target.value, orderPlanId: orderActiveId }));
                      }}
                      className="input-sm"
                    >
                      <option value="disabled">關閉</option>
                      <option value="active">啟用</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">對外標題</label>
                    <input
                      value={publicOrderLinkForm.title}
                      onChange={(event) => {
                        publicOrderLinkDraftTouchedRef.current = true;
                        setPublicOrderLinkForm((prev) => ({ ...prev, title: event.target.value, orderPlanId: orderActiveId }));
                      }}
                      placeholder="例如：4/12 中餐訂購"
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">外部截止時間</label>
                    <input
                      type="datetime-local"
                      value={publicOrderLinkForm.closeAt}
                      onChange={(event) => {
                        publicOrderLinkDraftTouchedRef.current = true;
                        setPublicOrderLinkForm((prev) => ({ ...prev, closeAt: event.target.value, orderPlanId: orderActiveId }));
                      }}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2 lg:col-span-2">
                    <label className="text-sm font-medium text-slate-700">對外說明</label>
                    <textarea
                      value={publicOrderLinkForm.description}
                      onChange={(event) => {
                        publicOrderLinkDraftTouchedRef.current = true;
                        setPublicOrderLinkForm((prev) => ({ ...prev, description: event.target.value, orderPlanId: orderActiveId }));
                      }}
                      rows="3"
                      placeholder="例如：提供其他班同學與學長姐訂餐，請於截止前完成填寫。"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="grid gap-2 lg:col-span-2">
                    <label className="text-sm font-medium text-slate-700">外部連結</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input value={publicOrderUrl} readOnly placeholder="先啟用並儲存後會產生連結" className="input-sm flex-1" />
                      <button
                        type="button"
                        onClick={async (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!publicOrderUrl) return;
                          try {
                            await navigator.clipboard.writeText(publicOrderUrl);
                            setOrderStatusMessage("已複製外部訂餐連結");
                          } catch (error) {
                            setOrderStatusMessage("複製失敗，請手動複製");
                          }
                        }}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        複製連結
                      </button>
                    </div>
                    {publicOrderUrl ? (
                      <p className="text-xs text-slate-400">目前外部頁站點：{publicSiteBase}</p>
                    ) : null}
                    {publicOrderLinkForm.status === "active" && !publicOrderUrl ? (
                      <p className="text-xs text-amber-600">已啟用，但連結尚未載入完成；儲存後會自動重新抓取。</p>
                    ) : null}
                  </div>
                  <div className="lg:col-span-2 flex flex-wrap items-end justify-between gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      {publicOrderUrl ? (
                        <div className="rounded-xl bg-white p-2">
                          <QRCodeSVG value={publicOrderUrl} size={144} includeMargin />
                        </div>
                      ) : (
                        <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-white text-xs text-slate-400">儲存後顯示 QR Code</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving || !orderActiveId} className="btn-primary">
                        {saving ? "儲存中..." : "儲存外部入口設定"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div className="card-muted p-5 text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">訂餐統計</p>
                  <span className="text-xs text-slate-400">
                    {activeOrderLabel || "尚未選擇訂餐日期"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-10">
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
                    <p className="text-xs text-slate-400">{orderForm.optionC || (hasOrderVegetarianChoice_(orderForm) ? "C 餐" : "素食餐")}</p>
                    <p className="text-lg font-semibold text-slate-900">{orderStats.C}</p>
                  </div>
                  {hasOrderVegetarianChoice_(orderForm) ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs text-slate-400">{orderForm.optionVegetarian || "素食餐"}</p>
                      <p className="text-lg font-semibold text-slate-900">{orderStats.VEG}</p>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-400">不吃</p>
                    <p className="text-lg font-semibold text-slate-900">{orderStats.NONE}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-400">已取餐</p>
                    <p className="text-lg font-semibold text-emerald-700">{orderStats.picked}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-400">未取餐</p>
                    <p className="text-lg font-semibold text-amber-700">{orderStats.unpicked}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-400">代訂</p>
                    <p className="text-lg font-semibold text-slate-900">{orderStats.proxy}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-400">外部自助</p>
                    <p className="text-lg font-semibold text-slate-900">{orderStats.public}</p>
                  </div>
                </div>


                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">依餐別查看名單</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <button
                        type="button"
                        onClick={handleExportOrderReportPdf}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                      >
                        匯出訂餐報表 PDF
                      </button>
                      <span>代訂 {proxyOrderResponses.length} 筆</span>
                      <span>未訂餐 {unsubmittedOrderStudents.length} 人</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { key: "ALL", label: "全部" },
                      ...getOrderChoiceOptions_(orderForm),
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setOrderMealFocus(item.key || item.value)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          orderMealFocus === (item.key || item.value)
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      value={orderRosterQuery}
                      onChange={(event) => setOrderRosterQuery(event.target.value)}
                      placeholder="搜尋姓名、學號、備註..."
                      className="h-9 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={orderOnlyUnpicked}
                        onChange={(event) => setOrderOnlyUnpicked(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      只顯示未取餐
                    </label>
                  </div>
                  <div className={`grid gap-4 ${orderMealFocus === "ALL" ? "xl:grid-cols-2" : "grid-cols-1"}`}>
                    {visibleGroupedOrderResponses.map((group) => (
                      <div key={group.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {group.items.length
                                ? `未取餐 ${group.unpickedItems.length} 人 · 已取餐 ${group.pickedItems.length} 人`
                                : "目前沒有人選這個餐別"}
                              {group.filteredItems.length !== group.items.length ? ` · 已篩選顯示 ${group.filteredItems.length} 人` : ""}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {group.items.length}
                          </span>
                        </div>

                        <div className="mt-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold text-slate-500">未取餐</p>
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              {group.unpickedItems.length}
                            </span>
                          </div>
                          <div className="space-y-2 text-xs text-slate-600">
                            {group.unpickedItems.length ? (
                              group.unpickedItems.map((item) => {
                                const isProxy = String(item.sourceType || "").trim() === "proxy_external";
                                const attendeeLabel = getOrderAttendeeLabel_(item);
                                const note = String(item.comment || "").trim();
                                return (
                                  <div
                                    key={item.id}
                                    className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span
                                            className="font-semibold text-slate-800"
                                            title={item.studentId ? `學號 ${item.studentId}` : ""}
                                          >
                                            {attendeeLabel}
                                          </span>
                                          {isProxy ? (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                              代訂
                                            </span>
                                          ) : null}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                          {isProxy && item.sourceLabel ? <span>{item.sourceLabel}</span> : null}
                                          {note ? <span>備註：{note}</span> : null}
                                        </div>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        {isProxy ? (
                                          <button
                                            type="button"
                                            onClick={() => handleEditProxyOrder(item)}
                                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                                          >
                                            編輯
                                          </button>
                                        ) : null}
                                        {isProxy ? (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteProxyOrder(item.id)}
                                            className="badge-error hover:border-rose-300"
                                          >
                                            刪除
                                          </button>
                                        ) : null}
                                        {group.key !== "NONE" ? (
                                          <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => handleSetOrderPickedUp(item, true)}
                                            className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                          >
                                            標記已取餐
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-slate-400">目前沒有未取餐名單。</p>
                            )}
                          </div>
                        </div>

                        {!orderOnlyUnpicked && group.key !== "NONE" ? (
                          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPickedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                              }
                              className="flex w-full items-center justify-between gap-2 text-left"
                            >
                              <span className="text-[11px] font-semibold text-slate-500">已取餐</span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {group.pickedItems.length}
                              </span>
                            </button>
                            {expandedPickedGroups[group.key] ? (
                              <div className="mt-3 space-y-2 text-xs text-slate-600">
                                {group.pickedItems.length ? (
                                  group.pickedItems.map((item) => {
                                    const isProxy = String(item.sourceType || "").trim() === "proxy_external";
                                    const attendeeLabel = getOrderAttendeeLabel_(item);
                                    const note = String(item.comment || "").trim();
                                    return (
                                      <div
                                        key={item.id}
                                        className="rounded-xl border border-emerald-200/70 bg-white px-3 py-2"
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="font-semibold text-slate-800">{attendeeLabel}</span>
                                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                已取餐
                                              </span>
                                              {isProxy ? (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                                  代訂
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                              {note ? <span>備註：{note}</span> : null}
                                              {item.pickedUpAt ? (
                                                <span>
                                                  {formatDisplayDate_(item.pickedUpAt, { withTime: true })}
                                                  {item.pickedUpByName ? ` · ${item.pickedUpByName}` : item.pickedUpBy ? ` · ${item.pickedUpBy}` : ""}
                                                </span>
                                              ) : null}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => handleSetOrderPickedUp(item, false)}
                                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-60"
                                          >
                                            取消取餐
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-xs text-slate-400">目前沒有已取餐名單。</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-600">未訂餐名單</p>
                        <p className="mt-1 text-[11px] text-slate-400">比對學生主檔，列出這個訂餐日期尚未送出回覆的同學。</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {unsubmittedOrderCopyStatus ? (
                          <span className="text-[11px] text-slate-400">{unsubmittedOrderCopyStatus}</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleCopyUnsubmittedOrderMentions}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                        >
                          複製 @名單
                        </button>
                        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                          {unsubmittedOrderStudents.length} 人
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      {activeSavedOrderId ? (
                        unsubmittedOrderStudents.length ? (
                          unsubmittedOrderStudents.map((student) => {
                            const studentId = String((student && student.id) || "").trim();
                            const studentLabel =
                              studentLabelByStudentId.get(studentId) ||
                              getChineseName_(student) ||
                              getDisplayName_(student) ||
                              studentId ||
                              "未命名";
                            return (
                              <div
                                key={studentId || studentLabel}
                                className="rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-semibold text-slate-800">{studentLabel}</span>
                                  {studentId ? (
                                    <span className="text-[11px] text-slate-500">{studentId}</span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-400">目前所有學生都已完成這個訂餐日期的回覆。</p>
                        )
                      ) : (
                        <p className="text-xs text-slate-400">請先選擇已儲存的訂餐日期，才能比對未訂餐名單。</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-600">用餐需求 / 備註總覽</p>
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      {orderComments.length ? (
                        orderComments.map((item) => (
                          <div
                            key={item.id || `${item.label}-${item.comment}`}
                            className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2"
                          >
                            <div className="font-semibold text-slate-800">{item.label}</div>
                            {item.isProxy && item.sourceLabel ? (
                              <div className="mt-0.5 text-[11px] text-slate-500">{item.sourceLabel}</div>
                            ) : null}
                            <div className="mt-1">{item.comment}</div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">目前沒有備註。</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "dietary" ? (
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">同學餐食喜好</p>
                    <span className="text-xs text-slate-500">給美食組快速查看全班飲食偏好</span>
                  </div>
                  <span className="text-xs text-slate-500">目前顯示 {dietaryFilteredRows.length} 位</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    value={dietaryQuery}
                    onChange={(event) => setDietaryQuery(event.target.value)}
                    placeholder="搜尋姓名、學號、飲食偏好..."
                    className="h-9 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleExportDietaryPreferenceCsv}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    匯出餐食喜好 CSV
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">目前篩選：全部同學</div>
                <div className="mt-4 grid gap-3 lg:grid-cols-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3">
                    <div className="flex items-center justify-between gap-2 text-emerald-700">
                      <p className="text-xs font-semibold">無禁忌</p>
                      <span className="text-xs tabular-nums">{dietaryNoRestrictionList.length} 位</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {dietaryNoRestrictionList.length ? (
                        dietaryNoRestrictionList.map((item) => (
                          <span
                            key={`dietary-none-${item.id || item.name}`}
                            className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-emerald-700"
                            title={item.id ? `學號 ${item.id}` : ""}
                          >
                            {item.name}
                          </span>
                        ))
                      ) : (
                        <p className="text-slate-400">目前沒有資料。</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-lime-200/70 bg-lime-50/50 p-3">
                    <div className="flex items-center justify-between gap-2 text-lime-700">
                      <p className="text-xs font-semibold">素食 / 蔬食</p>
                      <span className="text-xs tabular-nums">{dietaryVegetarianList.length} 位</span>
                    </div>
                    <div className="mt-2 space-y-2 text-xs">
                      {dietaryVegetarianGroups.length ? (
                        dietaryVegetarianGroups.map(([label, items]) => (
                          <div key={`veg-group-${label}`} className="rounded-lg border border-lime-200/70 bg-white/80 p-2">
                            <div className="mb-1 flex items-center justify-between text-lime-700">
                              <span className="font-semibold">{label}</span>
                              <span className="tabular-nums">{items.length} 位</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map((item) => (
                                <span
                                  key={`dietary-veg-${item.id || item.name}`}
                                  className="rounded-full border border-lime-200 bg-white px-2 py-0.5 text-lime-700"
                                  title={item.id ? `學號 ${item.id}` : ""}
                                >
                                  {item.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400">目前沒有資料。</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-3">
                    <div className="flex items-center justify-between gap-2 text-amber-700">
                      <p className="text-xs font-semibold">其他特殊飲食</p>
                      <span className="text-xs tabular-nums">{dietarySpecialList.length} 位</span>
                    </div>
                    <div className="mt-2 space-y-2 text-xs">
                      {dietarySpecialGroups.length ? (
                        dietarySpecialGroups.map(([label, items]) => (
                          <div key={`special-group-${label}`} className="rounded-lg border border-amber-200/70 bg-white/80 p-2">
                            <div className="mb-1 flex items-center justify-between text-amber-700">
                              <span className="font-semibold">{label}</span>
                              <span className="tabular-nums">{items.length} 位</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map((item) => (
                                <span
                                  key={`dietary-special-${item.id || item.name}`}
                                  className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-amber-700"
                                  title={item.id ? `學號 ${item.id}` : ""}
                                >
                                  {item.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400">目前沒有資料。</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-2 text-slate-600">
                      <p className="text-xs font-semibold">未填寫</p>
                      <span className="text-xs tabular-nums">{dietaryUnspecifiedList.length} 位</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {dietaryUnspecifiedList.length ? (
                        dietaryUnspecifiedList.map((item) => (
                          <span
                            key={`dietary-empty-${item.id || item.name}`}
                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600"
                            title={item.id ? `學號 ${item.id}` : ""}
                          >
                            {item.name}
                          </span>
                        ))
                      ) : (
                        <p className="text-slate-400">目前沒有資料。</p>
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
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">活動準備統計（出席）</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">僅計算回覆「出席」的報名資料</span>
                      <button
                        type="button"
                        onClick={handleExportAttendanceExcel}
                        disabled={!attendingRegistrationExportRows.length}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        匯出出席名單 Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportRegistrationStats}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        匯出統計
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs text-slate-500">出席人數</p>
                      <p className="text-lg font-semibold text-slate-900">{prepStats.attendingTotal}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs text-slate-500">停車位需求</p>
                      <p className="text-lg font-semibold text-slate-900">{prepStats.parkingNeeded}</p>
                    </div>
                    {registrationAllowCompanions ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-xs text-slate-500">攜伴總人數</p>
                        <p className="text-lg font-semibold text-slate-900">{prepStats.companionsTotal}</p>
                      </div>
                    ) : null}
                    {registrationAllowBringDrinks ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-xs text-slate-500">自帶酒水（人）</p>
                        <p className="text-lg font-semibold text-slate-900">{prepStats.bringDrinksCount}</p>
                      </div>
                    ) : null}
                  </div>
                  {isRegistrationTravelEvent ? (
                    <div className="mt-3 rounded-xl border border-sky-200/70 bg-sky-50/50 p-3">
                      <p className="text-xs font-semibold text-sky-700">旅遊交通方式</p>
                      <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                        {travelTransportationAttendeeGroups.map((group) => (
                          <div
                            key={`travel-transportation-${group.label}`}
                            className="rounded-lg border border-sky-200/70 bg-white px-3 py-2"
                          >
                            <p className="font-semibold text-slate-700">{group.label}</p>
                            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                              {group.count}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                              {group.attendees.length ? (
                                group.attendees.map((item) => (
                                  <span
                                    key={`travel-transportation-${group.label}-${item.name}`}
                                    className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                                  >
                                    {item.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400">目前沒有人選擇</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={`mt-3 grid gap-3 ${
                      registrationAllowBringDrinks ? "sm:grid-cols-3" : "sm:grid-cols-2"
                    }`}
                  >
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-600">飲食偏好統計</p>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {dietaryStatsList.length ? (
                          dietaryStatsList.map(([label, count]) => (
                            <div key={label} className="flex items-center justify-between">
                              <span>{label}</span>
                              <span className="font-semibold tabular-nums">{count}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400">目前沒有出席資料。</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-600">停車偏好統計</p>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {parkingStatsList.length ? (
                          parkingStatsList.map(([label, count]) => (
                            <div key={label} className="flex items-center justify-between">
                              <span>{label}</span>
                              <span className="font-semibold tabular-nums">{count}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400">目前沒有出席資料。</p>
                        )}
                      </div>
                    </div>
                    {registrationAllowBringDrinks ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-600">酒水數量統計</p>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {drinkQtyStatsList.length ? (
                            drinkQtyStatsList.map((item) => (
                              <div key={item.key} className="flex items-center justify-between">
                                <span>{item.label}</span>
                                <span className="font-semibold tabular-nums">{item.qty}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400">目前沒有酒水數量資料。</p>
                          )}
                        </div>
                        <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
                          不攜帶：{prepStats.notBringDrinksCount}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {registrationAllowCompanions ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-600">攜伴名單</p>
                          <span className="text-xs text-slate-500">共 {companionAttendeeList.length} 位</span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {companionAttendeeList.length ? (
                            companionAttendeeList.map((item) => (
                              <div
                                key={`companion-${item.name}`}
                                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1"
                              >
                                <span className="font-semibold text-slate-700">{item.name}</span>
                                <span className="tabular-nums text-slate-500">攜伴 {item.companions} 人</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400">目前沒有攜伴名單。</p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {registrationAllowBringDrinks ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-600">自帶酒水名單</p>
                          <span className="text-xs text-slate-500">共 {drinkAttendeeList.length} 位</span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {drinkAttendeeList.length ? (
                            drinkAttendeeList.map((item) => (
                              <div
                                key={`drink-${item.name}`}
                                className="rounded-lg border border-sky-200/70 bg-sky-50/60 px-2 py-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-700">{item.name}</span>
                                  <span className="text-sky-700">{item.bringDrinks || "攜帶"}</span>
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                  {item.drinkItems && item.drinkItems.length ? item.drinkItems.join("、") : "未填數量/品項"}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400">目前沒有自帶酒水名單。</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-600">素食/不吃肉名單</p>
                        <span className="text-xs text-slate-500">共 {vegetarianAttendeeList.length} 位</span>
                      </div>
                      <div className="mt-2 space-y-2 text-xs">
                        {vegetarianAttendeeGroupList.length ? (
                          vegetarianAttendeeGroupList.map(([dietary, names]) => (
                            <div
                              key={dietary}
                              className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 p-2"
                            >
                              <div className="mb-1 flex items-center justify-between text-emerald-700">
                                <span className="font-semibold">{dietary}</span>
                                <span className="tabular-nums">{names.length} 位</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {names.map((name, index) => (
                                  <span
                                    key={`${dietary}-${name}-${index}`}
                                    className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-700"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400">目前沒有素食/不吃肉名單。</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-600">其他特殊飲食/過敏</p>
                        <span className="text-xs text-slate-500">共 {specialDietAttendeeList.length} 位</span>
                      </div>
                      <div className="mt-2 space-y-2 text-xs">
                        {specialDietAttendeeGroupList.length ? (
                          specialDietAttendeeGroupList.map(([dietary, names]) => (
                            <div
                              key={dietary}
                              className="rounded-lg border border-amber-200/70 bg-amber-50/50 p-2"
                            >
                              <div className="mb-1 flex items-center justify-between text-amber-700">
                                <span className="font-semibold">{dietary}</span>
                                <span className="tabular-nums">{names.length} 位</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {names.map((name, index) => (
                                  <span
                                    key={`${dietary}-${name}-${index}`}
                                    className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] text-amber-700"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400">目前沒有其他特殊需求名單。</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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
                      const displayName = getChineseName_(student) || "未命名";
                      const isRegistered = studentId && registeredStudentIdSet.has(studentId);
                      const attendanceValue = (studentId && attendanceByStudentId.get(studentId)) || "";
                      const hoverTitle = [
                        studentId ? `學號 ${studentId}` : "",
                        student.googleEmail || student.email || "",
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      const attendanceStatus = normalizeAttendanceStatus_(attendanceValue);
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
                          {displayName}
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
                {checkinRegistrations.length ? (
                  <div className="flex flex-wrap gap-2">
                    {checkinRegistrations.map((registration) => {
                      const registrationId = String(registration.id || "").trim();
                      const checkin = checkinStatusByRegistrationId[registrationId] || null;
                      const fields = parseCustomFields_(registration.customFields);
                      const studentId = resolveRegistrationStudentId_(registration, fields);
                      const displayName =
                        (studentId && studentNameByStudentId.get(studentId)) ||
                        String(fields.name || "").trim() ||
                        "未命名";
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
                          {displayName}
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
                <p className="text-xs text-slate-500">共 {sortedDirectoryStudents.length} 筆</p>
                <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                  <input
                    value={studentsQuery}
                    onChange={(event) => setStudentsQuery(event.target.value)}
                    placeholder="搜尋姓名、Email、學號、公司..."
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400 sm:w-72"
                  />
                  <select
                    value={studentsGroupFilter}
                    onChange={(event) => setStudentsGroupFilter(event.target.value)}
                    className="h-9 min-w-[110px] rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400"
                  >
                    <option value="all">全部分組</option>
                    {directoryGroupOptions.map((groupId) => (
                      <option key={groupId} value={groupId}>
                        {groupId}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
                <table className="w-full min-w-[1660px] text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">
                        <button type="button" onClick={() => toggleStudentsSort_("nameZh")} className="font-semibold">
                          姓名 {studentsSortKey === "nameZh" ? (studentsSortDir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                      <th className="px-3 py-3">
                        <button type="button" onClick={() => toggleStudentsSort_("id")} className="font-semibold">
                          學號 {studentsSortKey === "id" ? (studentsSortDir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                      <th className="px-3 py-3">
                        <button type="button" onClick={() => toggleStudentsSort_("group")} className="font-semibold">
                          分組 {studentsSortKey === "group" ? (studentsSortDir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">稱呼</th>
                      <th className="px-3 py-3">英文名</th>
                      <th className="px-3 py-3">
                        <button type="button" onClick={() => toggleStudentsSort_("company")} className="font-semibold">
                          公司 {studentsSortKey === "company" ? (studentsSortDir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                      <th className="px-3 py-3">職稱</th>
                      <th className="px-3 py-3">手機</th>
                      <th className="px-3 py-3">社群</th>
                      <th className="px-3 py-3">備用電話</th>
                      <th className="px-3 py-3">緊急聯絡人</th>
                      <th className="px-3 py-3">緊急聯絡人電話</th>
                      <th className="px-3 py-3">
                        <button type="button" onClick={() => toggleStudentsSort_("birthday")} className="font-semibold">
                          生日 {studentsSortKey === "birthday" ? (studentsSortDir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                      <th className="px-3 py-3">飲食禁忌</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDirectoryStudents.map((item) => (
                      <tr key={item.id || item.email} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-3 font-semibold text-slate-900">{item.nameZh || "未命名"}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">{item.id || "-"}</td>
                        <td className="px-3 py-3">{item.group || "-"}</td>
                        <td className="px-3 py-3 text-xs">{item.email || "-"}</td>
                        <td className="px-3 py-3">{item.preferredName || "-"}</td>
                        <td className="px-3 py-3">{item.nameEn || "-"}</td>
                        <td className="px-3 py-3">{item.company || "-"}</td>
                        <td className="px-3 py-3">{item.title || "-"}</td>
                        <td className="px-3 py-3">{item.mobile || "-"}</td>
                        <td className="px-3 py-3 text-xs">{item.socialUrl || "-"}</td>
                        <td className="px-3 py-3">{item.backupPhone || "-"}</td>
                        <td className="px-3 py-3">{item.emergencyContact || "-"}</td>
                        <td className="px-3 py-3">{item.emergencyPhone || "-"}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {item.birthdayMonth && item.birthdayDay ? `${item.birthdayMonth}/${item.birthdayDay}` : "-"}
                        </td>
                        <td className="px-3 py-3">{item.dietaryRestrictions || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!sortedDirectoryStudents.length ? (
                  <div className="border-t border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    目前沒有可顯示資料
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === "quickLinks" ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <form onSubmit={handleSaveQuickLink_} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {quickLinkForm.id ? "編輯常用鏈結" : "新增常用鏈結"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">發布中的鏈結會顯示在首頁常用鏈結專區。</p>
                  </div>
                  {quickLinkForm.id ? (
                    <button type="button" onClick={resetQuickLinkForm_} className="btn-chip">
                      新增模式
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3">
                  <label className="text-xs font-semibold text-slate-600">
                    標題
                    <input
                      value={quickLinkForm.title}
                      onChange={(event) => setQuickLinkForm((prev) => ({ ...prev, title: event.target.value }))}
                      required
                      placeholder="例如：停車車號申請"
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    網址
                    <input
                      value={quickLinkForm.url}
                      onChange={(event) => setQuickLinkForm((prev) => ({ ...prev, url: event.target.value }))}
                      required
                      type="url"
                      placeholder="https://..."
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    說明
                    <textarea
                      value={quickLinkForm.description}
                      onChange={(event) => setQuickLinkForm((prev) => ({ ...prev, description: event.target.value }))}
                      rows={3}
                      placeholder="簡短說明同學什麼時候要用這個入口"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-1">
                      分類
                      <input
                        value={quickLinkForm.category}
                        onChange={(event) => setQuickLinkForm((prev) => ({ ...prev, category: event.target.value }))}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      狀態
                      <select
                        value={quickLinkForm.status}
                        onChange={(event) => setQuickLinkForm((prev) => ({ ...prev, status: event.target.value }))}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      >
                        <option value="published">發布</option>
                        <option value="draft">草稿</option>
                        <option value="archived">封存</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      排序
                      <input
                        value={quickLinkForm.sortOrder}
                        onChange={(event) => setQuickLinkForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                        type="number"
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "儲存中..." : "儲存鏈結"}
                  </button>
                  <button type="button" onClick={loadQuickLinksAdmin} disabled={saving} className="btn-chip">
                    重新載入
                  </button>
                  {quickLinkStatus ? <span className="text-xs font-semibold text-emerald-600">{quickLinkStatus}</span> : null}
                </div>
              </form>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">目前鏈結</p>
                    <p className="mt-1 text-xs text-slate-500">共 {quickLinks.length} 筆；只有「發布」會出現在首頁。</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {quickLinks.length ? quickLinks.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{item.title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                              {item.status === "published" ? "發布" : item.status === "draft" ? "草稿" : "封存"}
                            </span>
                            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                              {item.category || "general"}
                            </span>
                            <span className="text-[11px] text-slate-400">排序 {item.sortOrder}</span>
                          </div>
                          <p className="mt-1 break-all text-xs text-cyan-700">{item.url}</p>
                          {item.description ? <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p> : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button type="button" onClick={() => handleEditQuickLink_(item)} className="btn-chip">
                            編輯
                          </button>
                          <button type="button" onClick={() => handleDeleteQuickLink_(item)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      目前沒有常用鏈結。
                    </div>
                  )}
                </div>
              </div>
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
                        onClick={handleCopyLineMembershipExport_}
                        className="btn-chip"
                      >
                        匯出 LINE 版名單
                      </button>
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
                  {lineExportStatus ? (
                    <p className="mt-2 text-xs font-semibold text-sky-600">
                      {lineExportStatus}
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
                    <div className="mt-2 flex flex-wrap items-center gap-2 help-error-strong">
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

        {activeTab === "events" && isEventFormOpen ? (
          <section className="card p-7 sm:p-10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {activeId ? "編輯活動" : "新增活動"}
              </h2>
              <button
                type="button"
                onClick={() => setIsEventFormOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                收合
              </button>
            </div>
            <form
              ref={uploadFormRef}
              action={API_URL}
              method="post"
              encType="multipart/form-data"
              target="upload-frame"
              className="hidden"
            >
              <input type="hidden" name="eventId" value={form.id} />
              <input type="hidden" name="folderId" value={UPLOAD_FOLDER_ID || ""} />
              <input
                ref={uploadFileRef}
                id="event-upload-file"
                type="file"
                name="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
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
                {uploadError ? <span className="help-error">{uploadError}</span> : null}
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
                        className="help-error-strong"
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
              {activeId ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                  revision {Number(form.revisionNo || 0) || 0}
                </span>
              ) : null}
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
                    setIsEventFormOpen(false);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  取消編輯
                </button>
              ) : null}
            </div>
          </form>
          {activeId ? (
            <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-xl px-1 py-1 text-slate-700 marker:hidden">
                <span>
                  <span className="font-semibold text-slate-900">異動紀錄</span>
                  <span className="ml-2 text-slate-400">備查用，預設收合</span>
                </span>
                <span className="text-slate-400">
                  {eventAuditEvents.length ? `${eventAuditEvents.length} 筆` : form.title || form.id || "未選擇活動"} · 展開
                </span>
              </summary>
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {eventAuditLoading ? (
                  <p className="text-slate-400">載入中...</p>
                ) : eventAuditEvents.length ? (
                  eventAuditEvents.map((item) => {
                    const diffEntries = buildAuditDiffEntries_(item.diff || {});
                    const hiddenSystemFieldCount = Math.max(
                      0,
                      Object.entries(item.diff || {}).length - diffEntries.length
                    );
                    const summaryLabel = buildAuditSummary_(item, diffEntries);
                    return (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-800">{summaryLabel}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                                {formatAuditEntityLabel_(item.entityType)}
                              </span>
                              {item.revisionNo ? (
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                  r{item.revisionNo}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                              <span>{item.actorName || item.actorId || 'system'}</span>
                              {item.action ? <span>· {formatAuditActionLabel_(item.action)}</span> : null}
                              <span>· {formatDisplayDate_(item.createdAt, { withTime: true }) || item.createdAt}</span>
                            </div>
                            {diffEntries.length ? (
                              <div className="mt-2 space-y-1">
                                {diffEntries.slice(0, 6).map(([key, value]) => (
                                  <div key={key} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
                                    <span className="font-semibold text-slate-700">{formatAuditFieldLabel_(key)}</span>
                                    <span className="mx-1 text-slate-400">:</span>
                                    <span className="text-rose-600">{formatAuditValue_(key, value && value.before)}</span>
                                    <span className="mx-1 text-slate-400">→</span>
                                    <span className="text-emerald-700">{formatAuditValue_(key, value && value.after)}</span>
                                  </div>
                                ))}
                                {diffEntries.length > 6 ? <p className="text-[11px] text-slate-400">還有 {diffEntries.length - 6} 個欄位變更</p> : null}
                              </div>
                            ) : hiddenSystemFieldCount ? (
                              <p className="mt-2 text-[11px] text-slate-400">這次只有系統版本資訊變更，沒有內容欄位差異。</p>
                            ) : null}
                          </div>
                          {item.versionId ? (
                            <button
                              type="button"
                              disabled={saving || !canRestoreActiveEvent || item.canRestoreVersion === false}
                              onClick={() => handleRestoreEventAuditVersion(item)}
                              title={
                                !canRestoreActiveEvent
                                  ? eventRestoreBlockedReason
                                  : item.restoreBlockedReason || ""
                              }
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {canRestoreActiveEvent && item.canRestoreVersion !== false
                                ? "回復到這版"
                                : "已開放不可回復"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-400">目前沒有異動紀錄。</p>
                )}
              </div>
            </details>
          ) : null}
        </section>
        ) : null}

        {activeTab === "students" ? (
          <section className="card p-7 sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">通訊錄全欄位視圖</h2>
            <p className="mt-2 text-sm text-slate-500">
              此 tab 直接顯示通訊錄全部欄位，並提供即時搜尋、分組篩選與欄位排序。
            </p>
          </section>
        ) : null}

        {activeTab === "registrations" ? (
          <section className="card p-7 sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">報名操作</h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <form onSubmit={handleRegistrationSubmit} className="grid gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:grid-cols-2">
                <p className="text-sm font-semibold text-slate-800 sm:col-span-2">更新報名狀態</p>
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

              <form onSubmit={handleManualRegistrationSubmit} className="grid gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-sm font-semibold text-slate-800">補報名</p>
                  <p className="mt-1 text-xs text-slate-500">
                    目前活動：
                    {selectedRegistrationEvent
                      ? ` ${selectedRegistrationEvent.title || selectedRegistrationEvent.id} · ${selectedRegistrationEvent.id}`
                      : " 請先在上方選擇活動"}
                  </p>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">同學</label>
                  <input
                    value={manualRegistrationForm.studentQuery}
                    onChange={(event) =>
                      setManualRegistrationForm((prev) => ({ ...prev, studentQuery: event.target.value }))
                    }
                    list="manual-registration-students"
                    placeholder="輸入學號 / Email / 姓名"
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">出席回覆</label>
                  <select
                    value={manualRegistrationForm.attendance}
                    onChange={(event) =>
                      setManualRegistrationForm((prev) => ({
                        ...prev,
                        attendance: event.target.value,
                        ...(event.target.value === "出席" ? {} : { travelTransportation: "" }),
                      }))
                    }
                    className="input-sm"
                  >
                    <option value="出席">出席</option>
                    <option value="不克出席">不克出席</option>
                    <option value="尚未確定">尚未確定</option>
                  </select>
                </div>
                {isRegistrationTravelEvent &&
                normalizeAttendanceStatus_(manualRegistrationForm.attendance) === "attending" ? (
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">
                      {travelTransportationField.label}
                    </label>
                    <select
                      value={manualRegistrationForm.travelTransportation}
                      onChange={(event) =>
                        setManualRegistrationForm((prev) => ({
                          ...prev,
                          travelTransportation: event.target.value,
                        }))
                      }
                      className="input-sm"
                    >
                      <option value="" disabled>
                        請選擇
                      </option>
                      {(travelTransportationField.options || []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">備註</label>
                  <input
                    value={manualRegistrationForm.notes}
                    onChange={(event) =>
                      setManualRegistrationForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    placeholder="例如：電話確認後補登"
                    className="input-sm"
                  />
                </div>
                <div className="flex items-center gap-3 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={saving || !registrationEventId}
                    className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "處理中..." : "送出補報名"}
                  </button>
                  {manualRegistrationStatusMessage ? (
                    <span className="text-xs font-semibold text-emerald-600">
                      {manualRegistrationStatusMessage}
                    </span>
                  ) : null}
                </div>
              </form>
            </div>

            <datalist id="manual-registration-students">
              {displayStudents.map((item, index) => {
                const optionValue = String(item.id || item.email || item.googleEmail || "").trim();
                if (!optionValue) {
                  return null;
                }
                const optionLabel = [
                  getChineseName_(item) || getDisplayName_(item) || String(item.name || "").trim() || optionValue,
                  String(item.email || item.googleEmail || "").trim(),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <option key={`${optionValue}-${index}`} value={optionValue}>
                    {optionLabel}
                  </option>
                );
              })}
            </datalist>

            {manualRegistrationEntries.length ? (
              <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">最近補報名紀錄</p>
                <div className="mt-3 space-y-2">
                  {manualRegistrationEntries.map((item) => (
                    <div
                      key={item.id || `${item.userName}-${item.createdAt}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                    >
                      <span className="font-semibold text-slate-800">
                        {item.userName}
                        {item.studentId ? ` · ${item.studentId}` : ""}
                      </span>
                      <span>
                        {item.actorName ? `${item.actorName} · ` : ""}
                        {item.actorEmail || "未知操作者"} ·{" "}
                        {item.createdAt ? formatDisplayDate_(item.createdAt, { withTime: true }) : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
