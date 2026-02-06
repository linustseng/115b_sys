import React, { Suspense, useEffect, useRef, useState } from "react";
import { getCheckinErrorDisplay, mapRegistrationError } from "./utils/errorMappings";
import lineLinkGuide from "./assets/line_link.jpg";
const AdminPage = React.lazy(() => import("./pages/AdminPage"));
const DirectoryPage = React.lazy(() => import("./pages/DirectoryPage"));
const HomePage = React.lazy(() => import("./pages/HomePage"));
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const RegistrationPage = React.lazy(() => import("./pages/RegistrationPage"));
const CheckinPage = React.lazy(() => import("./pages/CheckinPage"));
const OrderingPage = React.lazy(() => import("./pages/OrderingPage"));
const FinancePage = React.lazy(() => import("./pages/FinancePage"));
const ApprovalsPage = React.lazy(() => import("./pages/ApprovalsPage"));
const FinanceAdminPage = React.lazy(() => import("./pages/FinanceAdminPage"));
const SoftballPage = React.lazy(() => import("./pages/SoftballPage"));
const SoftballPlayerPage = React.lazy(() => import("./pages/SoftballPlayerPage"));
import {
  addDays_,
  addMinutes_,
  generateEventId_,
  pad2_,
  parseLocalInputDate_,
  toLocalInput_,
  toLocalInputValue_,
} from "./adminUtils";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[AppErrorBoundary]", error, info);
    try {
      window.localStorage.setItem(
        "app_last_error",
        JSON.stringify({
          message: error && error.message ? error.message : "Unknown error",
          stack: error && error.stack ? error.stack : "",
          info: info && info.componentStack ? info.componentStack : "",
          at: Date.now(),
        })
      );
    } catch (err) {
      // Ignore storage failures
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50">
          <main className="mx-auto max-w-3xl px-6 py-16">
            <div className="card p-8 text-sm text-rose-700 border border-rose-200/80">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">
                Something went wrong
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-rose-800">系統發生錯誤</h1>
              <p className="mt-2 text-sm text-rose-600">
                請重新整理頁面。若持續發生，請把以下錯誤訊息回報給管理員。
              </p>
              <div className="mt-4 alert alert-error text-xs">
                {this.state.error.message || "Unknown error"}
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-500/30 hover:bg-rose-500"
              >
                重新整理
              </button>
            </div>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}

const gatheringFieldConfig = {
  attendance: {
    id: "attendance",
    label: "是否出席",
    options: ["出席", "不克出席", "尚未確定"],
  },
  companions: {
    id: "companions",
    label: "攜伴人數",
    type: "number",
    placeholder: "0",
  },
  dietary: {
    id: "dietary",
    label: "飲食偏好",
    type: "select",
    options: ["無禁忌", "素食但可海鮮", "不吃牛", "不吃羊", "素食"],
  },
  parking: {
    id: "parking",
    label: "是否需要停車位",
    options: ["需要", "不需要"],
  },
  drinks: {
    toggle: {
      id: "bringDrinks",
      label: "攜帶酒水",
      options: ["不攜帶", "攜帶"],
    },
    items: [
      {
        id: "redWineQty",
        label: "紅酒數量",
        type: "combo",
        options: ["0", "1", "2", "3", "4", "5", "6", "8", "10"],
        placeholder: "數量",
      },
      {
        id: "whiteWineQty",
        label: "白酒數量",
        type: "combo",
        options: ["0", "1", "2", "3", "4", "5", "6", "8", "10"],
        placeholder: "數量",
      },
      {
        id: "whiskyQty",
        label: "威士忌數量",
        type: "combo",
        options: ["0", "1", "2", "3", "4", "5", "6", "8", "10"],
        placeholder: "數量",
      },
      {
        id: "kaoliangQty",
        label: "高梁數量",
        type: "combo",
        options: ["0", "1", "2", "3", "4", "5", "6", "8", "10"],
        placeholder: "數量",
      },
      {
        id: "plumWineQty",
        label: "梅酒數量",
        type: "combo",
        options: ["0", "1", "2", "3", "4", "5", "6", "8", "10"],
        placeholder: "數量",
      },
      {
        id: "otherDrink",
        label: "其他酒水",
        type: "text",
        placeholder: "品項名稱",
      },
      {
        id: "otherDrinkQty",
        label: "其他酒水數量",
        type: "combo",
        options: ["0", "1", "2", "3", "4", "5", "6", "8", "10"],
        placeholder: "數量",
      },
    ],
  },
};

const meetingFields = [
  {
    id: "attendance",
    label: "是否出席",
    type: "select",
    options: ["出席", "不克出席", "尚未確定"],
    control: "buttons",
  },
  {
    id: "proxy",
    label: "代理出席",
    type: "text",
    placeholder: "若由他人代表出席請填寫姓名",
  },
  {
    id: "topics",
    label: "提案/議題",
    type: "text",
    placeholder: "希望討論的議題簡述",
  },
  {
    id: "projection",
    label: "是否需投影設備",
    type: "select",
    options: ["需要", "不需要"],
  },
];

const API_URL = import.meta.env.VITE_API_URL || "https://script.google.com/macros/s/REPLACE_ME/exec";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || "";
const EVENT_ID = "24101801";
const confirmDelete_ = (message) => {
  if (typeof window === "undefined") {
    return true;
  }
  return window.confirm(message || "確定要刪除嗎？此動作無法復原。");
};
const EVENT_CACHE_PREFIX = "event_info_cache_v1_";
const loadCachedEventInfo_ = (eventId) => {
  if (!eventId || typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(`${EVENT_CACHE_PREFIX}${eventId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) {
      return null;
    }
    return parsed.data;
  } catch (error) {
    return null;
  }
};
const saveCachedEventInfo_ = (eventId, data) => {
  if (!eventId || !data || typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      `${EVENT_CACHE_PREFIX}${eventId}`,
      JSON.stringify({ savedAt: Date.now(), data: data })
    );
  } catch (error) {
    // Ignore cache write errors (private mode, storage blocked, etc.)
  }
};
const DEFAULT_EVENT = {
  title: "秋季聚餐",
  location: "大直 · 磺溪會館",
  address: "台北市中山區樂群二路199號",
  startAt: "2024/10/18 18:30",
  endAt: "2024/10/18 21:30",
  registrationCloseAt: "",
  category: "gathering",
  capacity: 60,
  status: "open",
  allowCompanions: "yes",
  allowBringDrinks: "yes",
};

const EVENT_CATEGORIES = [
  { value: "gathering", label: "聚餐" },
  { value: "meeting", label: "會議" },
  { value: "softball", label: "壘球練習" },
];

const FINANCE_TYPES = [
  { value: "purchase", label: "請購" },
  { value: "payment", label: "請款" },
  { value: "pettycash", label: "零用金" },
];

const FINANCE_PAYMENT_METHODS = [
  { value: "reimbursement", label: "代墊報銷" },
  { value: "transfer", label: "財務直接轉帳給廠商" },
  { value: "pettycash", label: "零用金" },
];

const FINANCE_STATUS_LABELS = {
  draft: "草稿",
  pending_lead: "待組長審核",
  pending_rep: "待班代覆核",
  pending_committee: "待幹部審核",
  pending_accounting: "待會計作帳",
  pending_cashier: "待出納付款/發放",
  returned: "退回補件",
  closed: "已結案",
  withdrawn: "已撤回",
};

const FINANCE_ROLE_LABELS = {
  lead: "組長",
  rep: "班代",
  committee: "幹部",
  accounting: "會計",
  cashier: "出納",
  auditor: "監察人",
};

const CLASS_GROUPS = [
  { id: "A", label: "班代組" },
  { id: "B", label: "公關組" },
  { id: "C", label: "活動組" },
  { id: "D", label: "財會組" },
  { id: "E", label: "資訊組" },
  { id: "F", label: "學藝組" },
  { id: "G", label: "醫療組" },
  { id: "H", label: "體育主將組" },
  { id: "I", label: "美食組" },
  { id: "J", label: "班董" },
  { id: "K", label: "壘球隊" },
];

const GROUP_ROLE_OPTIONS = [
  { id: "lead", label: "組長" },
  { id: "deputy", label: "副組長" },
  { id: "member", label: "成員" },
];

const GROUP_ROLE_LABELS = {
  lead: "組長",
  deputy: "副組長",
  member: "成員",
};

const ROLE_BADGE_STYLES = {
  rep: "badge-warning",
  repDeputy: "border-orange-200 bg-orange-50 text-orange-700",
  lead: "badge-success",
  deputy: "border-sky-200 bg-sky-50 text-sky-700",
  member: "border-slate-200 bg-slate-100 text-slate-700",
  unassigned: "badge-error",
};

const FINANCE_ROLE_OPTIONS = [
  { id: "accounting", label: "會計" },
  { id: "cashier", label: "出納" },
  { id: "auditor", label: "監察人" },
];

const FUND_EVENT_STATUS = [
  { value: "collecting", label: "收取中" },
  { value: "closed", label: "已結案" },
];

const FUND_PAYER_TYPES = [
  { value: "general", label: "一般同學" },
  { value: "sponsor", label: "班董" },
];

const FUND_PAYMENT_METHODS = [
  { value: "transfer", label: "匯款" },
  { value: "cash", label: "現金" },
  { value: "other", label: "其他" },
];

const getCategoryLabel_ = (value) => {
  const match = EVENT_CATEGORIES.find((item) => item.value === value);
  return match ? match.label : "聚餐";
};

const getGroupLabel_ = (groupId) => {
  const match = CLASS_GROUPS.find((item) => item.id === groupId);
  return match ? match.label : groupId || "-";
};

const normalizeEmailValue_ = (value) => String(value || "").trim().toLowerCase();
const normalizeId_ = (value) => String(value || "").trim();

const buildAccessLabel_ = (groupIds) => {
  const labels = groupIds.map((id) => getGroupLabel_(id)).filter(Boolean);
  return labels.join("、");
};

const buildGoogleMapsUrl_ = (address) => {
  const normalized = String(address || "").trim();
  if (!normalized) {
    return "";
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalized)}`;
};

const normalizePhoneInputValue_ = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = String(value).trim();
  if (!raw) {
    return "";
  }
  if (/^\d{9}$/.test(raw) && raw.charAt(0) !== "0") {
    return `0${raw}`;
  }
  return raw;
};

const formatDisplayDate_ = (value, options = {}) => {
  if (!value) {
    return "";
  }
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }
  const dateOnlyMatch = /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(raw);
  const normalized =
    /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(raw)
      ? raw.replace(/\//g, "-").replace(" ", "T")
      : raw;
  const parsed = dateOnlyMatch
    ? (() => {
        const parts = raw.split(/[-/]/).map((part) => Number(part));
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return isNaN(date.getTime()) ? null : date;
      })()
    : new Date(normalized);
  if (!parsed || isNaN(parsed.getTime())) {
    return raw;
  }
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][parsed.getDay()];
  const dateLabel = `${parsed.getFullYear()}/${pad2_(parsed.getMonth() + 1)}/${pad2_(
    parsed.getDate()
  )} (週${weekday})`;
  const hasTime =
    options.withTime ||
    /T\d{2}:\d{2}/.test(normalized) ||
    /\d{2}:\d{2}/.test(raw);
  if (!hasTime) {
    return dateLabel;
  }
  if (
    !options.withTime &&
    parsed.getHours() === 0 &&
    parsed.getMinutes() === 0 &&
    /(T00:00| 00:00|00:00:00)/.test(normalized)
  ) {
    return dateLabel;
  }
  return `${dateLabel} ${pad2_(parsed.getHours())}:${pad2_(parsed.getMinutes())}`;
};

const formatEventDateTime_ = (value) => {
  return formatDisplayDate_(value, { withTime: true });
};

const formatEventDate_ = (value) => {
  return formatDisplayDate_(value);
};

const formatDisplayDateNoMidnight_ = (value) => {
  const withTime = formatDisplayDate_(value, { withTime: true });
  if (!withTime) {
    return "";
  }
  return withTime.endsWith(" 00:00") ? formatDisplayDate_(value) : withTime;
};

const toDateInputValue_ = (date) => {
  if (!date) {
    return "";
  }
  return `${date.getFullYear()}-${pad2_(date.getMonth() + 1)}-${pad2_(date.getDate())}`;
};

const parseFinanceAmount_ = (value) => {
  const raw = String(value || "").replace(/,/g, "").trim();
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatFinanceAmount_ = (value) => {
  const amount = parseFinanceAmount_(value);
  return amount ? `NT$ ${amount.toLocaleString("en-US")}` : "NT$ 0";
};

const normalizeGroupId_ = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) {
    return "";
  }
  const match = raw.match(/[A-Z0-9]+/);
  return match ? match[0] : raw;
};

const isPettyCashFinanceRequest_ = (record) => {
  const type = String(record.type || "").trim().toLowerCase();
  const method = String(record.paymentMethod || "").trim().toLowerCase();
  return type === "pettycash" || method === "pettycash";
};

const isPurchaseFinanceRequest_ = (record) =>
  String(record.type || "").trim().toLowerCase() === "purchase";

const requiresRepresentative_ = (record) =>
  parseFinanceAmount_(record.amountActual || record.amountEstimated) > 50000;

const requiresCommittee_ = (record) => {
  const amount = parseFinanceAmount_(record.amountActual || record.amountEstimated);
  const categoryType = String(record.categoryType || "").trim().toLowerCase();
  return amount >= 200000 || categoryType === "special";
};

const isFinanceRequestRelevantToRole_ = (record, role, context = {}) => {
  if (!record || !role) {
    return false;
  }
  const { adminLeadGroups = [], adminDeputyGroups = [] } = context;
  if (role === "auditor") {
    return true;
  }
  if (role === "lead") {
    const group = normalizeGroupId_(record.applicantDepartment);
    return adminLeadGroups.includes(group) || adminDeputyGroups.includes(group);
  }
  if (role === "rep") {
    return requiresRepresentative_(record) || requiresCommittee_(record);
  }
  if (role === "committee") {
    return requiresCommittee_(record);
  }
  if (role === "accounting" || role === "cashier") {
    return !isPurchaseFinanceRequest_(record);
  }
  return false;
};

const parseFinanceAttachments_ = (value) => {
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

const buildFinanceDraft_ = () => ({
  id: "",
  type: "purchase",
  title: "",
  description: "",
  categoryType: "general",
  amountEstimated: "",
  amountActual: "",
  currency: "TWD",
  paymentMethod: "reimbursement",
  vendorName: "",
  payeeName: "",
  payeeBank: "",
  payeeAccount: "",
  relatedPurchaseId: "",
  noPurchaseReason: "",
  expectedClearDate: "",
  attachments: [],
  status: "draft",
  applicantId: "",
  applicantName: "",
  applicantDepartment: "",
});

const parseCommaList_ = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const joinCommaList_ = (values) => (values && values.length ? values.join(", ") : "");

const buildFundEventDraft_ = () => ({
  id: "",
  title: "",
  description: "",
  dueDate: "",
  amountGeneral: "50000",
  amountSponsor: "200000",
  expectedGeneralCount: "",
  expectedSponsorCount: "",
  status: "collecting",
  notes: "",
});

const buildFundPaymentDraft_ = (eventId = "") => ({
  id: "",
  eventId: eventId,
  payerId: "",
  payerName: "",
  payerEmail: "",
  payerType: "general",
  amount: "",
  method: "transfer",
  transferLast5: "",
  receivedAt: toDateInputValue_(new Date()),
  accountedAt: "",
  confirmedAt: "",
  notes: "",
});

const formatEventTime_ = (value) => {
  if (!value) {
    return "";
  }
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const normalized =
    /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(raw)
      ? raw.replace(/\//g, "-").replace(" ", "T")
      : raw;
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) {
    return raw;
  }
  return `${pad2_(parsed.getHours())}:${pad2_(parsed.getMinutes())}`;
};

const formatEventSchedule_ = (startValue, endValue) => {
  if (!startValue || !endValue) {
    return {
      dateLabel: formatEventDate_(startValue || endValue),
      timeLabel: formatEventTime_(startValue || endValue),
    };
  }
  const startRaw = String(startValue || "").trim();
  const endRaw = String(endValue || "").trim();
  const startParsed = new Date(
    /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(startRaw)
      ? startRaw.replace(/\//g, "-").replace(" ", "T")
      : startRaw
  );
  const endParsed = new Date(
    /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(endRaw)
      ? endRaw.replace(/\//g, "-").replace(" ", "T")
      : endRaw
  );
  if (isNaN(startParsed.getTime()) || isNaN(endParsed.getTime())) {
    return {
      dateLabel: startRaw,
      timeLabel: endRaw ? `${startRaw} - ${endRaw}` : startRaw,
    };
  }
  const sameDay =
    startParsed.getFullYear() === endParsed.getFullYear() &&
    startParsed.getMonth() === endParsed.getMonth() &&
    startParsed.getDate() === endParsed.getDate();
  if (sameDay) {
    return {
      dateLabel: formatEventDate_(startRaw),
      timeLabel: `${formatEventTime_(startRaw)} - ${formatEventTime_(endRaw)}`,
    };
  }
  return {
    dateLabel: `${formatEventDateTime_(startRaw)} - ${formatEventDateTime_(endRaw)}`,
    timeLabel: "",
  };
};

const DRINK_FIELD_IDS = gatheringFieldConfig.drinks.items.map((item) => item.id);

const hasDrinkSelection_ = (fields) => {
  const source = fields || {};
  return DRINK_FIELD_IDS.some((id) => {
    const value = source[id];
    if (value === null || value === undefined) {
      return false;
    }
    const normalized = String(value).trim();
    return normalized !== "" && normalized !== "0";
  });
};

const normalizeCustomFieldsForSubmit_ = (fields, studentId) => {
  const source = fields || {};
  const bringDrinksValue = source.bringDrinks || (hasDrinkSelection_(source) ? "攜帶" : "");
  const normalized = { ...source, bringDrinks: bringDrinksValue };
  if (studentId && !normalized.studentId) {
    normalized.studentId = studentId;
  }
  if (bringDrinksValue === "不攜帶") {
    DRINK_FIELD_IDS.forEach((id) => {
      normalized[id] = "";
    });
  }
  return normalized;
};

const STORAGE_KEYS = {
  googleStudent: "emba115b.googleStudent",
};

function apiRequest(payload) {
  return new Promise((resolve, reject) => {
    if (!API_URL || API_URL.includes("REPLACE_ME")) {
      reject(new Error("API URL 未設定"));
      return;
    }
    const callbackName = `__emba_cb_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const url = new URL(API_URL);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("payload", JSON.stringify(payload));

    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Request timeout"));
    }, 8000);

    function cleanup() {
      clearTimeout(timeout);
      if (window[callbackName]) {
        delete window[callbackName];
      }
      script.remove();
    }

    window[callbackName] = (result) => {
      cleanup();
      resolve({ result, url: url.toString() });
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Network error"));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function loadStoredGoogleStudent_() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.googleStudent);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && parsed.student ? parsed.student : null;
  } catch (error) {
    return null;
  }
}

function storeGoogleStudent_(student) {
  try {
    if (!student) {
      window.localStorage.removeItem(STORAGE_KEYS.googleStudent);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEYS.googleStudent,
      JSON.stringify({ student: student, savedAt: Date.now() })
    );
  } catch (error) {
    // Ignore storage failures (private mode, quota).
  }
}

function getLineInAppInfo_() {
  if (typeof window === "undefined") {
    return { isLineInApp: false, openExternalUrl: "", currentUrl: "" };
  }
  const ua = navigator.userAgent || "";
  const isLineInApp = /Line/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOSBrowser = /Safari|CriOS|FxiOS|EdgiOS/i.test(ua);
  const isIOSInApp = isIOS && !isIOSBrowser;
  const isInApp = isLineInApp || isIOSInApp;
  if (!isLineInApp) {
    if (!isInApp) {
      return { isLineInApp: false, openExternalUrl: "", currentUrl: "" };
    }
  }
  const currentUrl = window.location.href;
  let openExternalUrl = currentUrl;
  if (isAndroid) {
    const url = new URL(currentUrl);
    openExternalUrl = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(
      ":",
      ""
    )};package=com.android.chrome;end`;
  } else if (isIOS) {
    openExternalUrl = `https://line.me/R/openExternal?url=${encodeURIComponent(currentUrl)}`;
  }
  return { isLineInApp: isInApp, openExternalUrl, currentUrl, isAndroid, isIOS };
}

function waitForGoogleIdentity(timeoutMs = 6000) {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Google Identity script not ready"));
      }
    }, 50);
  });
}

function GoogleSigninPanel({ onLinkedStudent = () => {}, title, helperText }) {
  const buttonRef = useRef(null);
  const onLinkedRef = useRef(onLinkedStudent);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [idToken, setIdToken] = useState("");
  const [linkedStudent, setLinkedStudent] = useState(null);
  const [emailMatch, setEmailMatch] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [showLineGuide, setShowLineGuide] = useState(false);
  const lineInfo = getLineInAppInfo_();
  const isLineInApp = lineInfo.isLineInApp;

  useEffect(() => {
    onLinkedRef.current = onLinkedStudent;
  }, [onLinkedStudent]);

  useEffect(() => {
    if (isLineInApp) {
      return;
    }
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) {
      return;
    }
    if (buttonRef.current.childNodes && buttonRef.current.childNodes.length > 0) {
      return;
    }
    let cancelled = false;
    waitForGoogleIdentity()
      .then(() => {
        if (cancelled) {
          return;
        }
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          use_fedcm_for_prompt: true,
          callback: async (response) => {
            if (!response || !response.credential) {
              return;
            }
            setStatus("verifying");
            setError("");
            setIdToken(response.credential);
            try {
              const { result } = await apiRequest({
                action: "verifyGoogle",
                idToken: response.credential,
              });
              if (!result.ok) {
                throw new Error(result.error || "Google 驗證失敗");
              }
              const payload = result.data || {};
              setProfile(payload.profile || null);
              setLinkedStudent(payload.student || null);
              setEmailMatch(payload.emailMatch || null);
              if (payload.student) {
                setStatus("linked");
                onLinkedRef.current(payload.student, payload.profile || null);
                storeGoogleStudent_(payload.student);
              } else {
                setStatus("needs-link");
              }
            } catch (err) {
              setStatus("error");
              setError(err.message || "Google 驗證失敗");
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          width: 280,
        });
        window.google.accounts.id.prompt();
      })
      .catch(() => {
        if (!cancelled) {
          setError("Google 登入元件載入失敗");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isLineInApp]);

  useEffect(() => {
    if (!profile || !query || String(query || "").trim().length < 2) {
      setResults([]);
      return;
    }
    let ignore = false;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { result } = await apiRequest({
          action: "searchStudents",
          query: String(query || "").trim(),
          idToken: idToken,
        });
        if (!result.ok) {
          throw new Error(result.error || "搜尋失敗");
        }
        if (!ignore) {
          setResults(result.data && result.data.students ? result.data.students : []);
        }
      } catch (err) {
        if (!ignore) {
          setResults([]);
        }
      } finally {
        if (!ignore) {
          setSearchLoading(false);
        }
      }
    }, 350);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [profile, query]);

  const handleLink = async (studentId) => {
    if (!idToken) {
      setError("請先登入 Google");
      return;
    }
    if (!studentId) {
      setError("缺少學號");
      return;
    }
    setLinkLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({
        action: "linkGoogleStudent",
        idToken: idToken,
        studentId: studentId,
      });
      if (!result.ok) {
        throw new Error(result.error || "綁定失敗");
      }
      const student = result.data && result.data.student ? result.data.student : null;
      setLinkedStudent(student);
      setStatus("linked");
      if (student) {
        onLinkedRef.current(student, profile);
      }
    } catch (err) {
      setError(err.message || "綁定失敗");
    } finally {
      setLinkLoading(false);
    }
  };

  const resolvedTitle = title || "Google 登入";
  const resolvedHelper = helperText || "登入後可快速帶入同學資料。";

  const handleCopyLink = async () => {
    if (!lineInfo.currentUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(lineInfo.currentUrl);
      setCopyStatus("copied");
    } catch (copyError) {
      setCopyStatus("failed");
    } finally {
      window.setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_-50px_rgba(15,23,42,0.7)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{resolvedTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">{resolvedHelper}</p>
        </div>
        {isLineInApp ? null : <div ref={buttonRef} />}
      </div>

      {isLineInApp ? (
        <div className="mt-4 alert alert-warning text-xs">
          <p className="font-semibold">LINE 內建瀏覽器無法完成 Google 登入</p>
          <p className="mt-1">
            {lineInfo.isIOS
              ? "請點右上角「…」選擇用 Safari 開啟，再進行登入。"
              : "請用手機預設瀏覽器開啟此頁，再進行登入。"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={lineInfo.openExternalUrl || lineInfo.currentUrl}
              target="_blank"
              rel="noopener"
              className="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm shadow-amber-500/30 hover:bg-amber-500"
            >
              {lineInfo.isIOS ? "用 Safari 開啟" : lineInfo.isAndroid ? "用 Chrome 開啟" : "用外部瀏覽器開啟"}
            </a>
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold text-amber-700"
            >
              複製連結
            </button>
            {copyStatus ? (
              <span className="text-[11px] font-semibold text-amber-700">
                {copyStatus === "copied" ? "已複製" : "複製失敗"}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setShowLineGuide((prev) => !prev)}
              className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold text-amber-700"
            >
              {showLineGuide ? "收合圖示" : "查看圖示"}
            </button>
          </div>
          {showLineGuide ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-amber-200 bg-white">
              <img
                src={lineLinkGuide}
                alt="LINE 內建瀏覽器開啟外部瀏覽器示意"
                className="h-auto w-full"
                loading="lazy"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!GOOGLE_CLIENT_ID ? (
        <p className="mt-3 text-xs text-amber-600">尚未設定 Google Client ID。</p>
      ) : null}

      {status === "linked" && linkedStudent ? (
        <div className="mt-4 alert alert-success">
          已綁定：{linkedStudent.name || "同學"} · {linkedStudent.email}
        </div>
      ) : null}

      {status !== "linked" && status !== "needs-link" ? (
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">建議先完成同學資料綁定</p>
          <p className="mt-1">
            登入 Google 後即可看到綁定流程。若登入後仍未出現，請改用 Safari / Chrome 開啟。
          </p>
          <button
            type="button"
            onClick={() => {
              if (profile) {
                setStatus("needs-link");
              }
            }}
            className="mt-2 btn-chip"
          >
            開始綁定
          </button>
        </div>
      ) : null}

      {status === "needs-link" && profile ? (
        <div className="mt-4 space-y-3">
          <div className="alert alert-warning text-xs">
            <p className="font-semibold">尚未綁定同學資料</p>
            <p className="mt-1">請搜尋並點選你的資料進行綁定。</p>
          </div>
          {emailMatch ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">找到相同 Email</p>
                  <p className="text-slate-500">
                    {emailMatch.name || "同學"} · {emailMatch.email}
                  </p>
                </div>
                <button
                  onClick={() => handleLink(emailMatch.id)}
                  disabled={linkLoading || !emailMatch.id}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {!emailMatch.id ? "缺少學號" : linkLoading ? "綁定中..." : "一鍵綁定"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2">
            <label className="text-xs font-semibold text-slate-600" htmlFor="google-link-query">
              搜尋同學姓名、Email 或 學號
            </label>
            <input
              id="google-link-query"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="輸入姓名 / Email"
              className="input-sm shadow-sm outline-none transition focus:border-slate-400"
            />
            {searchLoading ? <p className="text-xs text-slate-400">搜尋中...</p> : null}
          </div>
          {results.length ? (
            <div className="grid gap-2">
              {results.map((item) => (
                <button
                  key={`${item.id || item.email}-${item.name}`}
                  onClick={() => handleLink(item.id)}
                  disabled={linkLoading || !item.id}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
                >
                  <span>
                    <span className="font-semibold text-slate-900">{item.name || "同學"}</span>
                    {item.company ? ` · ${item.company}` : ""}
                    {item.group ? ` · ${item.group}` : ""}
                  </span>
                  <span className="text-xs text-slate-500">{item.email}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

function AdminAccessGuard({ title, allowedGroupIds, helperText, children }) {
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMemberships = async () => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listGroupMemberships" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setMemberships(result.data && result.data.memberships ? result.data.memberships : []);
    } catch (err) {
      setError(err.message || "權限載入失敗");
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemberships();
  }, [googleLinkedStudent]);

  const normalizedId = String((googleLinkedStudent && googleLinkedStudent.id) || "").trim();
  const userMemberships = memberships.filter((item) => {
    const memberId = String(item.personId || "").trim();
    if (normalizedId && memberId && normalizedId === memberId) {
      return true;
    }
    return false;
  });
  const hasAccess = userMemberships.some((item) => {
    const groupId = String(item.groupId || "").trim();
    const roleInGroup = String(item.roleInGroup || "").trim();
    if (groupId === "A" && (roleInGroup === "lead" || roleInGroup === "deputy")) {
      return true;
    }
    return allowedGroupIds.includes(groupId);
  });
  const allowedLabel = buildAccessLabel_(allowedGroupIds);

  if (!googleLinkedStudent || !googleLinkedStudent.email) {
    return (
      <div className="min-h-screen">
        <header className="px-6 pt-8 sm:px-12">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-slate-500">{helperText || "請先登入以取得權限。"}</p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
          <section className="card p-6 sm:p-8">
            <GoogleSigninPanel
              title="Google 登入"
              helperText="登入後會自動判斷可存取的後台權限。"
              onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
            />
          </section>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <header className="px-6 pt-8 sm:px-12">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              {title}
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 text-sm text-slate-600 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
            權限載入中...
          </div>
        </main>
      </div>
    );
  }

  if (error || !hasAccess) {
    return (
      <div className="min-h-screen">
        <header className="px-6 pt-8 sm:px-12">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              {title}
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
          <div className="card p-6 sm:p-8 text-sm text-rose-700 border border-rose-200/80 bg-rose-50/80">
            {error || "您目前沒有權限存取此後台。"}
            <div className="mt-2 text-xs text-rose-600">
              允許群組：班代、副班代{allowedLabel ? `、${allowedLabel}` : ""}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return children;
}

function PageLoader({ title = "載入中..." }) {
  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            NTU EMBA 115B
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
        <div className="card p-6 sm:p-8 text-sm text-slate-600">頁面載入中…</div>
      </main>
    </div>
  );
}

function AppShell() {
  const pathname = window.location.pathname;
  const isCheckinPage = pathname.includes("checkin");
  const isAdminEventsPage = pathname.includes("admin/events");
  const isAdminOrderingPage = pathname.includes("admin/ordering");
  const isAdminFinancePage = pathname.includes("admin/finance");
  const isAdminPage = pathname.includes("admin");
  const isRegisterPage = pathname.includes("register");
  const isEventsPage = pathname.includes("events");
  const isOrderingPage = pathname.includes("ordering");
  const isFinancePage = pathname.includes("finance");
  const isSoftballPlayerPage = pathname.includes("softball/player");
  const isSoftballPage = pathname.includes("softball");
  const isApprovalsPage = pathname.startsWith("/approvals");
  const lineInfo = getLineInAppInfo_();
  const [hideLineBanner, setHideLineBanner] = useState(() => {
    try {
      return window.sessionStorage.getItem("hide_line_banner") === "1";
    } catch (error) {
      return false;
    }
  });
  const [copyStatus, setCopyStatus] = useState("");
  const showLineBanner = lineInfo.isLineInApp && !hideLineBanner;
  const shared = {
    apiRequest,
    API_URL,
    PUBLIC_SITE_URL,
    GOOGLE_CLIENT_ID,
    EVENT_ID,
    DEFAULT_EVENT,
    DRINK_FIELD_IDS,
    gatheringFieldConfig,
    meetingFields,
    normalizePhoneInputValue_,
    formatDisplayDate_,
    formatDisplayDateNoMidnight_,
    formatEventSchedule_,
    buildGoogleMapsUrl_,
    getCategoryLabel_,
    getGroupLabel_,
    formatFinanceAmount_,
    loadCachedEventInfo_,
    saveCachedEventInfo_,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
    hasDrinkSelection_,
    normalizeCustomFieldsForSubmit_,
    mapRegistrationError,
    getCheckinErrorDisplay,
    GoogleSigninPanel,
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
    addDays_,
    addMinutes_,
    generateEventId_,
    pad2_,
    parseLocalInputDate_,
    toLocalInput_,
    toLocalInputValue_,
    toDateInputValue_,
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
  };

  const handleCopyLink = async () => {
    if (!lineInfo.currentUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(lineInfo.currentUrl);
      setCopyStatus("copied");
    } catch (copyError) {
      setCopyStatus("failed");
    } finally {
      window.setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  const handleHideBanner = () => {
    setHideLineBanner(true);
    try {
      window.sessionStorage.setItem("hide_line_banner", "1");
    } catch (error) {
      // Ignore storage errors.
    }
  };

  const lineBanner = showLineBanner ? (
    <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50/95 px-4 py-3 text-xs text-amber-900 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold">LINE 內建瀏覽器無法啟動 PWA</p>
          <p className="mt-1 text-amber-800">
            請點右上角「…」改用 {lineInfo.isIOS ? "Safari" : lineInfo.isAndroid ? "Chrome" : "外部瀏覽器"} 開啟，
            再加入主畫面。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={lineInfo.openExternalUrl || lineInfo.currentUrl}
            target="_blank"
            rel="noopener"
            className="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm shadow-amber-500/30 hover:bg-amber-500"
          >
            {lineInfo.isIOS ? "用 Safari 開啟" : lineInfo.isAndroid ? "用 Chrome 開啟" : "用外部瀏覽器開啟"}
          </a>
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold text-amber-700"
          >
            複製連結
          </button>
          {copyStatus ? (
            <span className="text-[11px] font-semibold text-amber-700">
              {copyStatus === "copied" ? "已複製" : "複製失敗"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleHideBanner}
            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold text-amber-700"
          >
            隱藏
          </button>
        </div>
      </div>
    </div>
  ) : null;

  let content = null;

  if (isCheckinPage) {
    content = <CheckinPage shared={shared} />;
  } else if (isAdminEventsPage) {
    content = (
      <AdminAccessGuard
        title="活動管理 · 後台"
        helperText="僅限班代、副班代、活動組、資管組成員。"
        allowedGroupIds={["C", "E"]}
      >
        <AdminPage
          apiRequest={apiRequest}
          API_URL={API_URL}
          buildGoogleMapsUrl_={buildGoogleMapsUrl_}
          formatDisplayDate_={formatDisplayDate_}
          getGroupLabel_={getGroupLabel_}
          EVENT_CATEGORIES={EVENT_CATEGORIES}
          PUBLIC_SITE_URL={PUBLIC_SITE_URL}
          GROUP_ROLE_LABELS={GROUP_ROLE_LABELS}
          ROLE_BADGE_STYLES={ROLE_BADGE_STYLES}
          CLASS_GROUPS={CLASS_GROUPS}
          initialTab="events"
          allowedTabs={["events", "registrations", "checkins", "students"]}
        />
      </AdminAccessGuard>
    );
  } else if (isAdminOrderingPage) {
    content = (
      <AdminAccessGuard
        title="訂餐管理 · 後台"
        helperText="僅限班代、副班代、美食組、資管組成員。"
        allowedGroupIds={["I", "E"]}
      >
        <AdminPage
          apiRequest={apiRequest}
          API_URL={API_URL}
          buildGoogleMapsUrl_={buildGoogleMapsUrl_}
          formatDisplayDate_={formatDisplayDate_}
          getGroupLabel_={getGroupLabel_}
          EVENT_CATEGORIES={EVENT_CATEGORIES}
          PUBLIC_SITE_URL={PUBLIC_SITE_URL}
          GROUP_ROLE_LABELS={GROUP_ROLE_LABELS}
          ROLE_BADGE_STYLES={ROLE_BADGE_STYLES}
          CLASS_GROUPS={CLASS_GROUPS}
          initialTab="ordering"
          allowedTabs={["ordering"]}
        />
      </AdminAccessGuard>
    );
  } else if (isAdminFinancePage) {
    content = (
      <AdminAccessGuard
        title="財務管理 · 後台"
        helperText="僅限班代、副班代、財會組、資管組成員。"
        allowedGroupIds={["D", "E"]}
      >
        <FinanceAdminPage shared={shared} />
      </AdminAccessGuard>
    );
  } else if (isAdminPage) {
    content = (
      <AdminAccessGuard
        title="後台管理 · MVP"
        helperText="僅限班代、副班代、資管組成員。"
        allowedGroupIds={["E"]}
      >
        <AdminPage
          apiRequest={apiRequest}
          API_URL={API_URL}
          buildGoogleMapsUrl_={buildGoogleMapsUrl_}
          formatDisplayDate_={formatDisplayDate_}
          getGroupLabel_={getGroupLabel_}
          EVENT_CATEGORIES={EVENT_CATEGORIES}
          PUBLIC_SITE_URL={PUBLIC_SITE_URL}
          GROUP_ROLE_LABELS={GROUP_ROLE_LABELS}
          ROLE_BADGE_STYLES={ROLE_BADGE_STYLES}
          CLASS_GROUPS={CLASS_GROUPS}
          initialTab="roles"
          allowedTabs={["students", "roles"]}
        />
      </AdminAccessGuard>
    );
  } else if (pathname.includes("directory")) {
    content = <DirectoryPage apiRequest={apiRequest} />;
  } else if (isRegisterPage) {
    content = <RegistrationPage shared={shared} />;
  } else if (isEventsPage) {
    content = (
      <HomePage
        apiRequest={apiRequest}
        buildGoogleMapsUrl_={buildGoogleMapsUrl_}
        formatDisplayDate_={formatDisplayDate_}
        formatEventSchedule_={formatEventSchedule_}
        getCategoryLabel_={getCategoryLabel_}
        loadStoredGoogleStudent_={loadStoredGoogleStudent_}
        GoogleSigninPanel={GoogleSigninPanel}
      />
    );
  } else if (isOrderingPage) {
    content = <OrderingPage shared={shared} />;
  } else if (isFinancePage) {
    content = <FinancePage shared={shared} />;
  } else if (isApprovalsPage) {
    content = <ApprovalsPage shared={shared} />;
  } else if (isSoftballPlayerPage) {
    content = <SoftballPlayerPage shared={shared} />;
  } else if (isSoftballPage) {
    content = (
      <AdminAccessGuard
        title="壘球隊管理 · 後台"
        helperText="僅限班代、副班代、資管組、體育主將組成員。"
        allowedGroupIds={["E", "H"]}
      >
        <SoftballPage shared={shared} />
      </AdminAccessGuard>
    );
  } else {
    content = (
      <LandingPage
        shared={shared}
        GoogleSigninPanel={GoogleSigninPanel}
        loadStoredGoogleStudent_={loadStoredGoogleStudent_}
      />
    );
  }

  return (
    <>
      {lineBanner}
      {content}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <AppShell />
      </Suspense>
    </ErrorBoundary>
  );
}
