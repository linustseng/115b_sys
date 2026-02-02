import React, { useEffect, useRef, useState } from "react";
import { getCheckinErrorDisplay, mapRegistrationError } from "./utils/errorMappings";
import emblem115b from "./assets/115b_icon.png";
import lineLinkGuide from "./assets/line_link.jpg";

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
            <div className="rounded-3xl border border-rose-200/80 bg-white p-8 text-sm text-rose-700 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.5)]">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">
                Something went wrong
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-rose-800">系統發生錯誤</h1>
              <p className="mt-2 text-sm text-rose-600">
                請重新整理頁面。若持續發生，請把以下錯誤訊息回報給管理員。
              </p>
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
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
  rep: "border-amber-200 bg-amber-50 text-amber-700",
  repDeputy: "border-orange-200 bg-orange-50 text-orange-700",
  lead: "border-emerald-200 bg-emerald-50 text-emerald-700",
  deputy: "border-sky-200 bg-sky-50 text-sky-700",
  member: "border-slate-200 bg-slate-100 text-slate-700",
  unassigned: "border-rose-200 bg-rose-50 text-rose-600",
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
  if (!isLineInApp) {
    return { isLineInApp: false, openExternalUrl: "", currentUrl: "" };
  }
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
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
  return { isLineInApp, openExternalUrl, currentUrl, isAndroid, isIOS };
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
        <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-xs text-amber-700">
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
        <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
          已綁定：{linkedStudent.name || "同學"} · {linkedStudent.email}
        </div>
      ) : null}

      {status === "needs-link" && profile ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-xs text-amber-700">
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
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
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

  const normalizedEmail = normalizeEmailValue_(googleLinkedStudent && googleLinkedStudent.email);
  const normalizedId = String((googleLinkedStudent && googleLinkedStudent.id) || "").trim();
  const userMemberships = memberships.filter((item) => {
    const memberId = String(item.personId || "").trim();
    const memberEmail = normalizeEmailValue_(item.personEmail);
    if (normalizedId && memberId && normalizedId === memberId) {
      return true;
    }
    return normalizedEmail && memberEmail && normalizedEmail === memberEmail;
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
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
          <div className="rounded-3xl border border-rose-200/80 bg-rose-50/80 p-6 text-sm text-rose-700 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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

  if (isCheckinPage) {
    return <CheckinPage />;
  }

  if (isAdminEventsPage) {
    return (
      <AdminAccessGuard
        title="活動管理 · 後台"
        helperText="僅限班代、副班代、活動組、資管組成員。"
        allowedGroupIds={["C", "E"]}
      >
        <AdminPage
          initialTab="events"
          allowedTabs={["events", "registrations", "checkins", "students"]}
        />
      </AdminAccessGuard>
    );
  }

  if (isAdminOrderingPage) {
    return (
      <AdminAccessGuard
        title="訂餐管理 · 後台"
        helperText="僅限班代、副班代、美食組、資管組成員。"
        allowedGroupIds={["I", "E"]}
      >
        <AdminPage initialTab="ordering" allowedTabs={["ordering"]} />
      </AdminAccessGuard>
    );
  }

  if (isAdminFinancePage) {
    return (
      <AdminAccessGuard
        title="財務管理 · 後台"
        helperText="僅限班代、副班代、財會組、資管組成員。"
        allowedGroupIds={["D", "E"]}
      >
        <FinanceAdminPage />
      </AdminAccessGuard>
    );
  }

  if (isAdminPage) {
    return (
      <AdminAccessGuard
        title="後台管理 · MVP"
        helperText="僅限班代、副班代、資管組成員。"
        allowedGroupIds={["E"]}
      >
        <AdminPage initialTab="roles" allowedTabs={["students", "roles"]} />
      </AdminAccessGuard>
    );
  }

  if (pathname.includes("directory")) {
    return <DirectoryPage />;
  }

  if (isRegisterPage) {
    return <RegistrationPage />;
  }

  if (isEventsPage) {
    return <HomePage />;
  }

  if (isOrderingPage) {
    return <OrderingPage />;
  }

  if (isFinancePage) {
    return <FinancePage />;
  }

  if (isApprovalsPage) {
    return <ApprovalsPage />;
  }

  if (isSoftballPlayerPage) {
    return <SoftballPlayerPage />;
  }

  if (isSoftballPage) {
    return (
      <AdminAccessGuard
        title="壘球隊管理 · 後台"
        helperText="僅限班代、副班代、資管組、體育主將組成員。"
        allowedGroupIds={["E", "H"]}
      >
        <SoftballPage />
      </AdminAccessGuard>
    );
  }

  return <LandingPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

function RegistrationPage() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId") || EVENT_ID;
  const slug = params.get("slug") || "";
  const categoryParam = params.get("category");
  const titleParam = params.get("title");
  const locationParam = params.get("location");
  const cachedEventInfo = loadCachedEventInfo_(eventId);

  const [email, setEmail] = useState("");
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [student, setStudent] = useState({
    name: "",
    company: "",
    title: "",
    phone: "",
    dietaryPreference: "",
  });
  const [customFields, setCustomFields] = useState({});
  const [notes, setNotes] = useState("");
  const [existingRegistration, setExistingRegistration] = useState(null);
  const [updatePromptOpen, setUpdatePromptOpen] = useState(false);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("idle");
  const [eventInfo, setEventInfo] = useState(cachedEventInfo || DEFAULT_EVENT);
  const [eventLoading, setEventLoading] = useState(!cachedEventInfo);
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const allowCompanions = String(eventInfo.allowCompanions || "yes").trim() !== "no";
  const allowBringDrinks = String(eventInfo.allowBringDrinks || "yes").trim() !== "no";
  const registrationDeadlineLabel = eventInfo.registrationCloseAt
    ? formatDisplayDate_(eventInfo.registrationCloseAt, { withTime: true })
    : "-";

  useEffect(() => {
    if (!googleLinkedStudent) {
      return;
    }
    const hasEmail = Boolean(googleLinkedStudent.email);
    setEmail(googleLinkedStudent.email || "");
    setStudent({
      name: googleLinkedStudent.name || "",
      company: googleLinkedStudent.company || "",
      title: googleLinkedStudent.title || "",
      phone: normalizePhoneInputValue_(googleLinkedStudent.phone),
      dietaryPreference: googleLinkedStudent.dietaryPreference || "",
    });
    setCustomFields((prev) =>
      prev.dietary
        ? prev
        : {
            ...prev,
            dietary: googleLinkedStudent.dietaryPreference || prev.dietary || "無禁忌",
          }
    );
    setAutoFilled(hasEmail);
    setLookupStatus(hasEmail ? "found" : "idle");
  }, [googleLinkedStudent]);

  useEffect(() => {
    setCustomFields((prev) => {
      const next = { ...prev };
      if (!allowCompanions) {
        delete next.companions;
      }
      if (!allowBringDrinks) {
        next.bringDrinks = "不攜帶";
        DRINK_FIELD_IDS.forEach((id) => {
          delete next[id];
        });
      }
      return next;
    });
  }, [allowCompanions, allowBringDrinks]);

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

  const loadExistingRegistration = async (emailValue) => {
    const normalized = String(emailValue || "").trim().toLowerCase();
    if (!normalized || !eventId) {
      setExistingRegistration(null);
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "getRegistrationByEmail",
        eventId: eventId,
        email: normalized,
      });
      if (!result.ok || !result.data || !result.data.registration) {
        setExistingRegistration(null);
        return;
      }
      const registration = result.data.registration;
      const storedFields = parseCustomFields_(registration.customFields);
      const notesValue = storedFields.notes || "";
      const { notes: _notes, ...restFields } = storedFields;
      setExistingRegistration(registration);
      setCustomFields((prev) => ({
        ...prev,
        ...restFields,
      }));
      setNotes(notesValue || "");
      setStudent((prev) => ({
        ...prev,
        name: registration.userName || prev.name,
        phone: normalizePhoneInputValue_(registration.userPhone || prev.phone),
      }));
    } catch (error) {
      setExistingRegistration(null);
    }
  };

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    const needsDirectory =
      !googleLinkedStudent.company &&
      !googleLinkedStudent.title &&
      !googleLinkedStudent.phone &&
      !googleLinkedStudent.group;
    if (!needsDirectory) {
      return;
    }
    let ignore = false;
    const fetchDirectory = async () => {
      try {
        const { result } = await apiRequest({
          action: "lookupStudent",
          email: String(googleLinkedStudent.email || "").trim().toLowerCase(),
        });
        if (!result.ok) {
          throw new Error(result.error || "Student not found");
        }
        if (!ignore && result.data && result.data.student) {
          const enriched = result.data.student;
          setGoogleLinkedStudent(enriched);
          storeGoogleStudent_(enriched);
        }
      } catch (error) {
        if (!ignore) {
          setLookupStatus((prev) => (prev === "idle" ? prev : "found"));
        }
      }
    };
    fetchDirectory();
    return () => {
      ignore = true;
    };
  }, [googleLinkedStudent]);

  const handleEmailChange = (value) => {
    const normalized = value.toLowerCase();
    setEmail(normalized);
    if (!normalized) {
      setAutoFilled(false);
      setLookupStatus("idle");
      setStudent({ name: "", company: "", title: "", phone: "", dietaryPreference: "" });
    }
  };

  useEffect(() => {
    if (!eventId) {
      return;
    }
    let ignore = false;
    const cached = loadCachedEventInfo_(eventId);
    if (cached) {
      setEventInfo({
        ...DEFAULT_EVENT,
        ...cached,
        title: titleParam || cached.title || DEFAULT_EVENT.title,
        location: locationParam || cached.location || DEFAULT_EVENT.location,
        category: categoryParam || cached.category || DEFAULT_EVENT.category,
      });
      setEventLoading(false);
    } else {
      setEventInfo({
        ...DEFAULT_EVENT,
        title: titleParam || DEFAULT_EVENT.title,
        location: locationParam || DEFAULT_EVENT.location,
        category: categoryParam || DEFAULT_EVENT.category,
      });
      setEventLoading(true);
    }
    const fetchEvent = async () => {
      try {
        const { result } = await apiRequest({ action: "getEvent", eventId: eventId });
        if (!result.ok) {
          throw new Error(result.error || "Event not found");
        }
        if (!ignore && result.data && result.data.event) {
          const event = result.data.event;
          const nextEventInfo = {
            title: titleParam || event.title || DEFAULT_EVENT.title,
            location: locationParam || event.location || DEFAULT_EVENT.location,
            address: event.address || DEFAULT_EVENT.address,
            startAt: event.startAt || DEFAULT_EVENT.startAt,
            endAt: event.endAt || DEFAULT_EVENT.endAt,
            registrationCloseAt: event.registrationCloseAt || DEFAULT_EVENT.registrationCloseAt,
            category: event.category || categoryParam || DEFAULT_EVENT.category,
            capacity: event.capacity || DEFAULT_EVENT.capacity,
            status: event.status || DEFAULT_EVENT.status,
            allowCompanions: event.allowCompanions || DEFAULT_EVENT.allowCompanions,
            allowBringDrinks: event.allowBringDrinks || DEFAULT_EVENT.allowBringDrinks,
          };
          setEventInfo(nextEventInfo);
          saveCachedEventInfo_(eventId, nextEventInfo);
        }
      } catch (error) {
        if (!ignore && (titleParam || locationParam || categoryParam)) {
          setEventInfo((prev) => ({
            ...prev,
            title: titleParam || prev.title,
            location: locationParam || prev.location,
            address: prev.address,
            category: categoryParam || prev.category,
          }));
        }
      } finally {
        if (!ignore) {
          setEventLoading(false);
        }
      }
    };
    fetchEvent();
    return () => {
      ignore = true;
    };
  }, [eventId, titleParam, locationParam, categoryParam]);

  useEffect(() => {
    if (!email) {
      return;
    }
    let ignore = false;
    setLookupStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const { result } = await apiRequest({
          action: "lookupStudent",
          email: String(email || "").trim().toLowerCase(),
        });
        if (!result.ok) {
          throw new Error(result.error || "Student not found");
        }
        if (!ignore && result.data && result.data.student) {
          const match = result.data.student;
          setStudent({
            name: match.name || "",
            company: match.company || "",
            title: match.title || "",
            phone: normalizePhoneInputValue_(match.phone),
            dietaryPreference: match.dietaryPreference || "",
          });
          setCustomFields((prev) =>
            prev.dietary && prev.studentId
              ? prev
              : {
                  ...prev,
                  dietary: match.dietaryPreference || prev.dietary || "無禁忌",
                  studentId: match.id || prev.studentId || "",
                }
          );
          setAutoFilled(true);
          setLookupStatus("found");
          await loadExistingRegistration(String(email || "").trim().toLowerCase());
        }
      } catch (error) {
        if (!ignore) {
          setAutoFilled(false);
          setLookupStatus("notfound");
          setStudent({ name: "", company: "", title: "", phone: "", dietaryPreference: "" });
          setExistingRegistration(null);
        }
      }
    }, 500);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [email]);

  const handleCustomFieldChange = (fieldId, value) => {
    setCustomFields((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleBringDrinksChange = (value) => {
    setCustomFields((prev) => {
      const next = { ...prev, bringDrinks: value };
      if (value === "不攜帶") {
        DRINK_FIELD_IDS.forEach((id) => {
          next[id] = "";
        });
      }
      return next;
    });
  };

  const handleRegister = async () => {
    setSubmitError("");
    setSubmitSuccess(false);
    if (!String(email || "").trim()) {
      setSubmitError("請先輸入 Email 以帶入同學資料。");
      return;
    }
    if (!String(student.name || "").trim()) {
      setSubmitError("請確認姓名資料是否正確。");
      return;
    }
    if (!String(student.phone || "").trim()) {
      setSubmitError("請填寫聯絡資訊。");
      return;
    }
    if (existingRegistration) {
      setUpdatePromptOpen(true);
      return;
    }
    setSubmitLoading(true);
    try {
      const linkedStudentId =
        googleLinkedStudent && googleLinkedStudent.id
          ? String(googleLinkedStudent.id || "").trim()
          : "";
      const payloadCustomFields = normalizeCustomFieldsForSubmit_(
        customFields,
        linkedStudentId
      );
      const { result } = await apiRequest({
        action: "register",
        data: {
          eventId: eventId,
          slug: slug,
          studentId: linkedStudentId,
          userEmail: String(email || "").trim().toLowerCase(),
          userName: String(student.name || "").trim(),
          userPhone: String(student.phone || "").trim(),
          customFields: {
            ...payloadCustomFields,
            notes: String(notes || "").trim(),
          },
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "報名失敗");
      }
      setSubmitSuccess(true);
    } catch (err) {
      const errorMessage = err.message || "報名失敗";
      if (String(errorMessage).toLowerCase().includes("duplicate")) {
        await loadExistingRegistration(String(email || "").trim().toLowerCase());
        setUpdatePromptOpen(true);
        return;
      }
      setSubmitError(mapRegistrationError(errorMessage));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUpdateRegistration = async () => {
    if (!existingRegistration || !existingRegistration.id) {
      setUpdatePromptOpen(false);
      return;
    }
    setUpdateSubmitting(true);
    setSubmitError("");
    try {
      const linkedStudentId =
        googleLinkedStudent && googleLinkedStudent.id
          ? String(googleLinkedStudent.id || "").trim()
          : "";
      const payloadCustomFields = {
        ...normalizeCustomFieldsForSubmit_(customFields, linkedStudentId),
        notes: String(notes || "").trim(),
      };
      const { result } = await apiRequest({
        action: "updateRegistration",
        data: {
          id: existingRegistration.id,
          eventId: eventId,
          studentId: linkedStudentId,
          userName: String(student.name || "").trim(),
          userEmail: String(email || "").trim().toLowerCase(),
          userPhone: String(student.phone || "").trim(),
          customFields: JSON.stringify(payloadCustomFields),
          status: existingRegistration.status || "registered",
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      setUpdatePromptOpen(false);
      setSubmitSuccess(true);
      await loadExistingRegistration(String(email || "").trim().toLowerCase());
    } catch (err) {
      setSubmitError(err.message || "更新失敗");
    } finally {
      setUpdateSubmitting(false);
    }
  };

  const bringDrinksValue =
    customFields.bringDrinks || (hasDrinkSelection_(customFields) ? "攜帶" : "");

  const renderOptionButtons = (field, selectedValue, onChange) => (
    <div className="flex flex-wrap gap-2">
      {field.options.map((option) => {
        const isActive = selectedValue === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              isActive
                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );

  const renderComboField = (field, value, onChange) => (
    <>
      <input
        id={field.id}
        type="text"
        list={`${field.id}-options`}
        placeholder={field.placeholder || "數量"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
      />
      <datalist id={`${field.id}-options`}>
        {field.options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8f5f0]">
      <div className="pointer-events-none absolute -left-40 top-[-180px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2),rgba(59,130,246,0))]" />
      <div className="pointer-events-none absolute right-[-140px] top-[120px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.25),rgba(245,158,11,0))]" />
      <div className="pointer-events-none absolute bottom-[-220px] left-1/3 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),rgba(16,185,129,0))]" />
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              {eventInfo.title} 報名
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white sm:inline-flex"
            >
              返回報名列表
            </a>
            {eventLoading ? (
              <span className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm sm:inline-flex">
                活動資料載入中
              </span>
            ) : null}
            <span className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm sm:inline-flex">
              {eventInfo.status === "open" ? "報名進行中" : "報名狀態更新"} · 名額 {eventInfo.capacity}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 pb-28 pt-10 sm:grid-cols-[1.1fr_0.9fr] sm:px-12">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">報名資料</h2>
            {autoFilled ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                已帶入同學資料
              </span>
            ) : existingRegistration ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                已有報名資料
              </span>
            ) : lookupStatus === "loading" ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                搜尋中
              </span>
            ) : lookupStatus === "notfound" ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                查無資料
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                請輸入 Email
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-6">
            {googleLinkedStudent && googleLinkedStudent.email ? (
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
                已登入 Google：{googleLinkedStudent.email}
              </div>
            ) : (
              <GoogleSigninPanel
                title="Google 登入"
                helperText="登入後綁定同學資料，就不用再輸入 Email。"
                onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
              />
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => handleEmailChange(event.target.value)}
                placeholder="you@emba115b.tw"
                disabled={Boolean(googleLinkedStudent && googleLinkedStudent.email)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <p className="text-xs text-slate-500">
                {googleLinkedStudent && googleLinkedStudent.email
                  ? "已透過 Google 綁定同學資料。"
                  : "輸入後將自動帶入姓名與公司等資料。"}
              </p>
              {lookupStatus === "notfound" ? (
                <p className="text-xs text-amber-600">查無資料，請確認 Email 是否正確或請承辦補登。</p>
              ) : null}
              {lookupStatus === "loading" ? (
                <p className="text-xs text-slate-400">正在查詢同學資料...</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="name">
                  姓名
                </label>
                <input
                  id="name"
                  type="text"
                  value={student.name}
                  placeholder="王小明"
                  onChange={(event) => setStudent({ ...student, name: event.target.value })}
                  disabled={Boolean(student.name)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                  聯絡資訊
                </label>
                <input
                  id="phone"
                  type="text"
                  value={student.phone}
                  placeholder="手機或其他聯絡方式"
                  onChange={(event) => setStudent({ ...student, phone: event.target.value })}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200/70 pt-8">
            <h3 className="text-base font-semibold text-slate-900">
              {getCategoryLabel_(eventInfo.category)} 自訂欄位
            </h3>
            {eventInfo.category === "meeting" ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {meetingFields.map((field) => {
                  const value = customFields[field.id] || "";
                  if (field.control === "buttons") {
                    return (
                      <div key={field.id} className="grid gap-2 sm:col-span-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor={field.id}>
                          {field.label}
                        </label>
                        {renderOptionButtons(field, value, (next) =>
                          handleCustomFieldChange(field.id, next)
                        )}
                      </div>
                    );
                  }
                  if (field.type === "select") {
                    return (
                      <div key={field.id} className="grid gap-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor={field.id}>
                          {field.label}
                        </label>
                        <select
                          id={field.id}
                          value={value}
                          onChange={(event) => handleCustomFieldChange(field.id, event.target.value)}
                          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                        >
                          <option value="" disabled>
                            請選擇
                          </option>
                          {field.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <div key={field.id} className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor={field.id}>
                        {field.label}
                      </label>
                      <input
                        id={field.id}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={value}
                        onChange={(event) => handleCustomFieldChange(field.id, event.target.value)}
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="attendance">
                      {gatheringFieldConfig.attendance.label}
                    </label>
                    {renderOptionButtons(
                      gatheringFieldConfig.attendance,
                      customFields.attendance || "",
                      (next) => handleCustomFieldChange(gatheringFieldConfig.attendance.id, next)
                    )}
                  </div>
                  {allowCompanions ? (
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700" htmlFor="companions">
                        {gatheringFieldConfig.companions.label}
                      </label>
                      <input
                        id="companions"
                        type="number"
                        placeholder={gatheringFieldConfig.companions.placeholder}
                        value={customFields.companions || ""}
                        onChange={(event) =>
                          handleCustomFieldChange(
                            gatheringFieldConfig.companions.id,
                            event.target.value
                          )
                        }
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="dietary">
                      {gatheringFieldConfig.dietary.label}
                    </label>
                    <select
                      id="dietary"
                      value={customFields.dietary || ""}
                      onChange={(event) =>
                        handleCustomFieldChange(
                          gatheringFieldConfig.dietary.id,
                          event.target.value
                        )
                      }
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                    >
                      <option value="" disabled>
                        請選擇
                      </option>
                      {gatheringFieldConfig.dietary.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="parking">
                      {gatheringFieldConfig.parking.label}
                    </label>
                    {renderOptionButtons(
                      gatheringFieldConfig.parking,
                      customFields.parking || "",
                      (next) => handleCustomFieldChange(gatheringFieldConfig.parking.id, next)
                    )}
                  </div>
                </div>

                {allowBringDrinks ? (
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {gatheringFieldConfig.drinks.toggle.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          若會攜帶酒水，請填寫品項與數量。
                        </p>
                      </div>
                      {renderOptionButtons(
                        gatheringFieldConfig.drinks.toggle,
                        bringDrinksValue,
                        (next) => handleBringDrinksChange(next)
                      )}
                    </div>
                    {bringDrinksValue === "攜帶" ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {gatheringFieldConfig.drinks.items.map((field) => (
                          <div key={field.id} className="grid gap-2">
                            <label className="text-sm font-medium text-slate-700" htmlFor={field.id}>
                              {field.label}
                            </label>
                            {field.type === "combo" ? (
                              renderComboField(field, customFields[field.id] || "", (next) =>
                                handleCustomFieldChange(field.id, next)
                              )
                            ) : (
                              <input
                                id={field.id}
                                type={field.type}
                                placeholder={field.placeholder}
                                value={customFields[field.id] || ""}
                                onChange={(event) =>
                                  handleCustomFieldChange(field.id, event.target.value)
                                }
                                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-400">目前未攜帶酒水。</p>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-10 border-t border-slate-200/70 pt-8">
            <label className="text-sm font-medium text-slate-700" htmlFor="notes">
              備註 (選填)
            </label>
            <textarea
              id="notes"
              rows="4"
              placeholder="有任何特殊需求請在此填寫"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
            />
          </div>

          {submitError ? (
            <div className="mt-8 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
              <p className="font-semibold">報名未完成</p>
              <p className="mt-1 text-amber-600">{submitError}</p>
              <p className="mt-2 text-xs text-amber-500">若持續無法送出，請聯繫班級承辦。</p>
            </div>
          ) : null}

          {submitSuccess ? (
            <div className="mt-8 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
              <p className="font-semibold">報名成功</p>
              <p className="mt-1 text-emerald-600">已完成報名，期待與你相見。</p>
            </div>
          ) : null}

          <button
            onClick={handleRegister}
            disabled={submitLoading}
            className="mt-10 hidden w-full items-center justify-center gap-2 rounded-2xl bg-[#1e293b] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
          >
            {submitLoading ? "送出中..." : "送出報名"}
          </button>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_25px_70px_-60px_rgba(15,23,42,0.7)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              活動資訊
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">
              {eventInfo.title} · {eventInfo.location}
            </h2>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {(() => {
                const schedule = formatEventSchedule_(eventInfo.startAt, eventInfo.endAt);
                return (
                  <>
              <div className="flex items-center justify-between">
                <span>日期</span>
                <span className="font-medium text-slate-800">{schedule.dateLabel || "-"}</span>
              </div>
              {schedule.timeLabel ? (
                <div className="flex items-center justify-between">
                  <span>時間</span>
                  <span className="font-medium text-slate-800">{schedule.timeLabel}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span>地點</span>
                <span className="font-medium text-slate-800">{eventInfo.location}</span>
              </div>
              {eventInfo.address ? (
                <div className="flex items-center justify-between">
                  <span>地址</span>
                  <div className="flex items-center gap-2 text-right">
                    <span className="font-medium text-slate-800">{eventInfo.address}</span>
                    <a
                      href={buildGoogleMapsUrl_(eventInfo.address)}
                      target="_blank"
                      rel="noreferrer"
                      title="開啟 Google 地圖"
                      aria-label="開啟 Google 地圖"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      >
                        <path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                    </a>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span>類別</span>
                <span className="font-medium text-slate-800">
              {getCategoryLabel_(eventInfo.category)}
                </span>
              </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_25px_70px_-60px_rgba(15,23,42,0.7)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              報名提醒
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>報名截止：{registrationDeadlineLabel}</li>
              {allowCompanions ? <li>攜伴請於備註註明姓名</li> : null}
              <li>若改為不克出席請於截止日前更新</li>
            </ul>
          </div>
        </aside>
      </main>

      <div className="fixed bottom-5 left-4 right-4 z-20 sm:hidden">
        <button
          onClick={handleRegister}
          disabled={submitLoading}
          className="flex w-full items-center justify-center rounded-2xl bg-[#1e293b] px-6 py-4 text-base font-semibold text-white shadow-2xl shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLoading ? "送出中..." : "送出報名"}
        </button>
      </div>

      {updatePromptOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-6">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Update Registration
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">已報名資料</h2>
            <p className="mt-3 text-sm text-slate-500">
              系統已找到你的報名紀錄，是否要更新報名資料？
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setUpdatePromptOpen(false)}
                className="rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                取消
              </button>
              <button
                onClick={handleUpdateRegistration}
                disabled={updateSubmitting}
                className="rounded-full bg-[#1e293b] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateSubmitting ? "更新中..." : "更新報名"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LandingPage() {
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const displayName =
    (googleLinkedStudent && (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    "";
  const hasGoogleLogin = Boolean(googleLinkedStudent && googleLinkedStudent.email);
  const [loginCollapsed, setLoginCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.innerWidth < 768;
  });
  const [showCalendarMobile, setShowCalendarMobile] = useState(() => {
    try {
      const stored = localStorage.getItem("home_calendar_mobile_open");
      if (stored === null) {
        return true;
      }
      return stored === "1";
    } catch (error) {
      return true;
    }
  });
  const calendarEmbedUrl =
    "https://calendar.google.com/calendar/embed?src=d07db9571997a7592737ae50fc3062ab8a1105d0e3b794ded9672b1e6cd0502a%40group.calendar.google.com&ctz=Asia%2FTaipei";

  useEffect(() => {
    if (!hasGoogleLogin) {
      setLoginCollapsed(false);
    }
  }, [hasGoogleLogin]);

  useEffect(() => {
    try {
      localStorage.setItem("home_calendar_mobile_open", showCalendarMobile ? "1" : "0");
    } catch (error) {
      // Ignore write errors (private mode, blocked storage, etc.)
    }
  }, [showCalendarMobile]);

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12 entrance">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-4">
              <img
                src={emblem115b}
                alt="NTU EMBA 115B"
                className="h-12 w-12 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  NTU EMBA 115B
                </p>
                <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                  115B 班務系統
                </h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              共學 · 共餐 · 共練 · 2026-2028 and forever
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 px-5 py-4 text-xs text-slate-600 shadow-sm">
            {hasGoogleLogin ? (
              <div>
                <p className="font-semibold text-slate-900">
                  {displayName ? `${displayName} 已登入` : "已登入"}
                </p>
                <p className="mt-1 text-slate-500">{googleLinkedStudent.email}</p>
              </div>
            ) : (
              <p className="font-semibold text-slate-600">尚未登入 Google</p>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-6 sm:px-12">
        {!hasGoogleLogin ? (
          <section className="entrance entrance-delay-1 mb-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_80px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Google 登入</h2>
              <button
                type="button"
                onClick={() => setLoginCollapsed((prev) => !prev)}
                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
              >
                {loginCollapsed ? "展開 ▼" : "收合 ▲"}
              </button>
            </div>
            {!loginCollapsed ? (
              <>
                <div className="mt-4">
                  <GoogleSigninPanel
                    title="Google 登入"
                    helperText="請先完成綁定，才能使用活動、訂餐與壘球功能。"
                    onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
                  />
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  登入後會儲存在本機，後續進入各系統會自動帶入。
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 sm:gap-5 lg:grid-cols-2 xl:grid-cols-4">
          <div className="entrance entrance-delay-3 group flex h-full flex-col justify-between rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_30px_80px_-70px_rgba(15,23,42,0.9)] transition hover:-translate-y-1 hover:shadow-lg">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  System 01
                </p>
                <img
                  src={emblem115b}
                  alt="NTU EMBA 115B"
                  className="h-10 w-10 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
                />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">活動管理系統</h3>
              <p className="mt-3 text-sm text-slate-500">
                報名、簽到與活動資訊一站完成。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/events"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              <a
                href="/admin/events"
                className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-slate-900/30 hover:bg-slate-800"
              >
                活動管理
              </a>
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between rounded-[2rem] border border-amber-200/70 bg-amber-50/70 p-6 shadow-[0_25px_70px_-60px_rgba(120,53,15,0.4)] transition hover:-translate-y-1 hover:shadow-lg">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600/70">
                  System 02
                </p>
                <img
                  src={emblem115b}
                  alt="NTU EMBA 115B"
                  className="h-10 w-10 rounded-2xl border border-amber-200 bg-white p-1 shadow-sm"
                />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">訂餐系統</h3>
              <p className="mt-3 text-sm text-amber-900/80">
                週末與特別課程訂餐，前一日 23:59 截止。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/ordering"
                className="inline-flex items-center rounded-full border border-amber-300 bg-white px-4 py-1.5 text-sm font-semibold text-amber-700 shadow-sm hover:border-amber-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              <a
                href="/admin/ordering"
                className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-amber-500/30 hover:bg-amber-500"
              >
                訂餐管理
              </a>
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between rounded-[2rem] border border-sky-200/70 bg-sky-50/70 p-6 shadow-[0_25px_70px_-60px_rgba(14,116,144,0.35)] transition hover:-translate-y-1 hover:shadow-lg">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600/70">
                  System 03
                </p>
                <img
                  src={emblem115b}
                  alt="NTU EMBA 115B"
                  className="h-10 w-10 rounded-2xl border border-sky-200 bg-white p-1 shadow-sm"
                />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">財務管理</h3>
              <p className="mt-3 text-sm text-sky-900/80">
                班費請購、請款與零用金申請。
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/finance"
                className="inline-flex items-center rounded-full border border-sky-300 bg-white px-4 py-1.5 text-sm font-semibold text-sky-700 shadow-sm hover:border-sky-400"
              >
                同學入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              <a
                href="/admin/finance"
                className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-500"
              >
                財務管理
              </a>
            </div>
          </div>

          <div className="entrance entrance-delay-4 group flex h-full flex-col justify-between rounded-[2rem] border border-emerald-200/70 bg-emerald-50/70 p-6 shadow-[0_25px_70px_-60px_rgba(16,185,129,0.35)] transition hover:-translate-y-1 hover:shadow-lg">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600/70">
                  System 04
                </p>
                <img
                  src={emblem115b}
                  alt="NTU EMBA 115B"
                  className="h-10 w-10 rounded-2xl border border-emerald-200 bg-white p-1 shadow-sm"
                />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">壘球隊管理</h3>
              <p className="mt-3 text-sm text-emerald-900/80">練習排程、點名與出席統計。</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/softball/player"
                className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-4 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm hover:border-emerald-400"
              >
                球員入口
                <span className="ml-2 text-base transition group-hover:translate-x-1">→</span>
              </a>
              <a
                href="/softball"
                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-500"
              >
                前往管理
              </a>
            </div>
          </div>
        </section>

        <section className="entrance entrance-delay-3 mt-8 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
          <ApprovalsCenter embedded requestId="" />
        </section>

        {hasGoogleLogin ? (
          <section className="entrance entrance-delay-2 mt-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Google 登入</h2>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                  已登入
                </span>
                <button
                  type="button"
                  onClick={() => setLoginCollapsed((prev) => !prev)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                >
                  {loginCollapsed ? "展開 ▼" : "收合 ▲"}
                </button>
              </div>
            </div>
            {!loginCollapsed ? (
              <>
                <div className="mt-4">
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-2 text-xs text-emerald-700">
                    已登入 Google：{googleLinkedStudent.email}
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  登入後會儲存在本機，後續進入活動、訂餐與壘球系統會自動帶入。
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="entrance entrance-delay-3 mt-6 rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.7)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">班級行李曆</h2>
              <p className="mt-2 text-sm text-slate-500">
                共用行李曆同步最新活動安排，手機可收合或新視窗查看。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCalendarMobile((prev) => !prev)}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 sm:hidden"
              >
                {showCalendarMobile ? "收合行李曆" : "展開行李曆"}
              </button>
              <a
                href={calendarEmbedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                在新視窗開啟
              </a>
            </div>
          </div>

          {!showCalendarMobile ? (
            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:hidden">
              為了保持手機順暢，可先收合行李曆。
            </div>
          ) : null}

          {showCalendarMobile ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white sm:hidden">
              <iframe
                title="班級行李曆（手機）"
                src={calendarEmbedUrl}
                className="h-[480px] w-full"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer"
                scrolling="no"
              />
            </div>
          ) : null}

          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white sm:block">
            <iframe
              title="班級行李曆"
              src={calendarEmbedUrl}
              className="h-[560px] w-full"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer"
              scrolling="no"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function OrderingPage() {
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

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">本週訂餐</h2>
            {loading ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                載入中
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
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

function FinancePage() {
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

  const resolveMemberGroups_ = (email, memberships) => {
    if (!email) {
      return [];
    }
    const normalized = normalizeEmailValue_(email);
    return (memberships || [])
      .filter((item) => normalizeEmailValue_(item.personEmail) === normalized)
      .map((item) => String(item.groupId || "").trim())
      .filter(Boolean);
  };

  const loadMemberGroups = async (email) => {
    if (!email) {
      setMemberGroups([]);
      return;
    }
    try {
      const { result } = await apiRequest({ action: "listGroupMemberships" });
      if (!result.ok) {
        return;
      }
      const memberships = result.data && result.data.memberships ? result.data.memberships : [];
      const normalized = String(email || "").trim().toLowerCase();
      const groups = memberships
        .filter((item) => String(item.personEmail || "").trim().toLowerCase() === normalized)
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
      setMemberGroups(resolveMemberGroups_(email, memberships));
      return true;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    if (googleLinkedStudent && googleLinkedStudent.email) {
      setRequestsLoaded(false);
      setRequestBootstrapLoaded(false);
      loadMemberGroups(googleLinkedStudent.email);
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
  }, []);

  useEffect(() => {
    if (fundPaymentForm.eventId) {
      loadFundPayments(fundPaymentForm.eventId);
    }
  }, [fundPaymentForm.eventId]);

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
    const draftApplicantId = form.applicantId || resolvedApplicant.id;
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
    const resolvedApplicantId = form.applicantId || resolvedApplicant.id;
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

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
          <div className="mt-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
            {statusMessage}
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-6">
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
              <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
                {fundStatusMessage}
              </div>
            ) : null}
            <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <form
                onSubmit={handleFundPaymentSubmit}
                className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">班費繳交回報</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {memberGroups.includes("J") ? "班董" : "一般同學"}
                  </span>
                </div>
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
                          ? "border-rose-300 bg-rose-50/60"
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
                      <div className="flex flex-wrap items-center gap-3 text-xs text-rose-500">
                        <span>{fundEventsError}</span>
                        <button
                          type="button"
                          onClick={loadFundEvents}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-600"
                        >
                          重新載入
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {fundPaymentForm.eventId && fundPayments.length ? (
                    <div className="sm:col-span-2 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs text-amber-700">
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
                          ? "border-rose-300 bg-rose-50/60"
                          : "border-slate-200 bg-white"
                      }`}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">付款方式</label>
                    <select
                      value={fundPaymentForm.method}
                      onChange={(event) => handleFundPaymentChange("method", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                            ? "border-rose-300 bg-rose-50/60"
                            : "border-slate-200 bg-white"
                        }`}
                      />
                      {fundPaymentErrorFlags.transferLast5 ? (
                        <p className="text-xs text-rose-500">請填寫匯款帳號末 5 碼。</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">匯款日期</label>
                    <input
                      type="date"
                      value={fundPaymentForm.receivedAt}
                      onChange={(event) => handleFundPaymentChange("receivedAt", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                  <div className="mt-4 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-xs text-rose-700">
                    {error}
                  </div>
                ) : null}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "送出中..." : "送出繳費回報"}
                  </button>
                </div>
              </form>

              <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
                            匯款: {formatDisplayDate_(item.receivedAt) || "-"} · 入帳:{" "}
                            {formatDisplayDate_(item.accountedAt) || "-"}
                          </p>
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
              className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">新建申請</h2>
                {editingId ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    編輯中 {editingId}
                  </span>
                ) : null}
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    申請類型 <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(event) => handleFormChange("type", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    請款人 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    value={form.applicantName}
                    onChange={(event) => handleApplicantInputChange(event.target.value)}
                    list="finance-students"
                    placeholder="請輸入或選擇學號 + 姓名"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    申請組別 <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={form.applicantDepartment}
                    onChange={(event) => handleFormChange("applicantDepartment", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                  項目名稱 <span className="text-rose-600">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(event) => handleFormChange("title", event.target.value)}
                  placeholder="例如壘球比賽"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  說明/活動內容 <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) => handleFormChange("description", event.target.value)}
                  rows="3"
                  placeholder="例如教練費、場地租金等"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  班務性質 <span className="text-rose-600">*</span>
                </label>
                <select
                  value={form.categoryType}
                  onChange={(event) => handleFormChange("categoryType", event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                  {isPurchase ? "預估金額" : "實際金額"} <span className="text-rose-600">*</span>
                </label>
                <input
                  value={isPurchase ? form.amountEstimated : form.amountActual}
                  onChange={(event) =>
                    handleFormChange(isPurchase ? "amountEstimated" : "amountActual", event.target.value)
                  }
                  placeholder="NT$"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
              </div>
              {isPayment ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">請款方式</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(event) => handleFormChange("paymentMethod", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
              ) : null}
              {isPayment ? (
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">對應請購</label>
                  <input
                    value={form.relatedPurchaseId}
                    onChange={(event) => handleFormChange("relatedPurchaseId", event.target.value)}
                    placeholder="請購單號 (可選)"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
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
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">銀行/帳號</label>
                    <input
                      value={form.payeeAccount}
                      onChange={(event) => handleFormChange("payeeAccount", event.target.value)}
                      placeholder="轉帳帳號"
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-6 space-y-3">
              <label className="text-sm font-medium text-slate-700">附件</label>
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
                        className="text-xs font-semibold text-rose-600"
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
                className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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

            <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
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
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => handleEditRequest(item)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                            >
                              編輯
                            </button>
                          ) : null}
                          {canWithdraw ? (
                            <button
                              type="button"
                              onClick={() => handleWithdraw(item)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
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

function ApprovalsCenter({ embedded = false, requestId = "" }) {
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [requests, setRequests] = useState([]);
  const [actions, setActions] = useState([]);
  const [actionsByActor, setActionsByActor] = useState([]);
  const [groupMemberships, setGroupMemberships] = useState([]);
  const [financeRoles, setFinanceRoles] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pending");
  const [actorName, setActorName] = useState("");
  const [actorNote, setActorNote] = useState("");
  const [acting, setActing] = useState(false);
  const displayName =
    (googleLinkedStudent && (googleLinkedStudent.preferredName || googleLinkedStudent.nameZh)) ||
    (googleLinkedStudent && googleLinkedStudent.name) ||
    (googleLinkedStudent && googleLinkedStudent.email) ||
    "";

  useEffect(() => {
    if (displayName && !actorName) {
      setActorName(displayName);
    }
  }, [displayName, actorName]);

  const loadBootstrap = async () => {
    const { result } = await apiRequest({ action: "listFinanceAdminBootstrap" });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    const data = result.data || {};
    setStudents(data.students || []);
    setGroupMemberships(data.groupMemberships || []);
    setFinanceRoles(data.roles || []);
  };

  const loadRequests = async () => {
    const { result } = await apiRequest({ action: "listFinanceRequests" });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    setRequests(result.data && result.data.requests ? result.data.requests : []);
  };

  const loadActionsByActor = async () => {
    if (!displayName) {
      setActionsByActor([]);
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "listFinanceActionsByActor",
        actorNames: [displayName],
      });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setActionsByActor(result.data && result.data.actions ? result.data.actions : []);
    } catch (err) {
      // Backward-compatible: backend not deployed yet.
      setActionsByActor([]);
    }
  };

  const loadActions = async (targetId) => {
    if (!targetId) {
      setActions([]);
      return;
    }
    const { result } = await apiRequest({ action: "listFinanceActions", requestId: targetId });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    setActions(result.data && result.data.actions ? result.data.actions : []);
  };

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    let ignore = false;
    setLoading(true);
    setError("");
    Promise.all([loadBootstrap(), loadRequests(), loadActionsByActor()])
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "載入失敗");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [googleLinkedStudent]);

  useEffect(() => {
    if (!requestId) {
      setActions([]);
      return;
    }
    loadActions(requestId).catch(() => {});
  }, [requestId]);

  const normalizedEmail = String((googleLinkedStudent && googleLinkedStudent.email) || "")
    .trim()
    .toLowerCase();
  const studentMatch =
    students.find((item) => String(item.email || "").trim().toLowerCase() === normalizedEmail) ||
    null;
  const personId = String((studentMatch && studentMatch.id) || "").trim();
  const memberships = groupMemberships.filter((item) => {
    if (personId && String(item.personId || "").trim() === personId) {
      return true;
    }
    return String(item.personEmail || "").trim().toLowerCase() === normalizedEmail;
  });
  const financeRoleItems = financeRoles.filter((item) => {
    if (personId && String(item.personId || "").trim() === personId) {
      return true;
    }
    return String(item.personEmail || "").trim().toLowerCase() === normalizedEmail;
  });

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

  const hasLeadPrivilege = adminLeadGroups.length || adminDeputyGroups.length;
  const hasRepPrivilege = adminLeadGroups.includes("A");
  const hasCommitteePrivilege = hasLeadPrivilege || hasRepPrivilege || adminDeputyGroups.includes("A");
  const hasAccountingPrivilege = adminRoles.includes("accounting");
  const hasCashierPrivilege = adminRoles.includes("cashier");
  const hasAuditorPrivilege = adminRoles.includes("auditor");

  const roleStatusMap = {
    lead: "pending_lead",
    rep: "pending_rep",
    committee: "pending_committee",
    accounting: "pending_accounting",
    cashier: "pending_cashier",
    auditor: "auditor",
  };

  const availableRoles = [
    hasLeadPrivilege ? "lead" : null,
    hasRepPrivilege ? "rep" : null,
    hasCommitteePrivilege ? "committee" : null,
    hasAccountingPrivilege ? "accounting" : null,
    hasCashierPrivilege ? "cashier" : null,
    hasAuditorPrivilege ? "auditor" : null,
  ].filter((value) => value);

  const resolveRequestRole_ = (item) => {
    if (!item) {
      return "";
    }
    for (let i = 0; i < availableRoles.length; i += 1) {
      const role = availableRoles[i];
      if (role === "auditor") {
        continue;
      }
      const targetStatus = roleStatusMap[role];
      if (String(item.status || "").trim() !== targetStatus) {
        continue;
      }
      if (role === "lead") {
        const group = String(item.applicantDepartment || "").trim();
        if (
          !adminLeadGroups.includes(group) &&
          !adminDeputyGroups.includes(group)
        ) {
          continue;
        }
      }
      return role;
    }
    return "";
  };

  const pendingItems = requests
    .map((item) => ({ request: item, role: resolveRequestRole_(item) }))
    .filter((item) => item.role)
    .sort((a, b) => String(b.request.createdAt || "").localeCompare(String(a.request.createdAt || "")));

  const actionByRequestId = actionsByActor.reduce((acc, item) => {
    const id = String(item.requestId || "").trim();
    if (!id) {
      return acc;
    }
    if (!acc[id]) {
      acc[id] = item;
    }
    return acc;
  }, {});

  const signedItems = requests
    .map((item) => ({
      request: item,
      action: actionByRequestId[String(item.id || "").trim()] || null,
    }))
    .filter((item) => item.action)
    .sort((a, b) =>
      String(b.action && b.action.createdAt || "").localeCompare(
        String(a.action && a.action.createdAt || "")
      )
    );

  const selectedRequest = requestId
    ? requests.find((item) => String(item.id || "").trim() === String(requestId || "").trim())
    : null;
  const selectedRole = selectedRequest ? resolveRequestRole_(selectedRequest) : "";
  const canAct = Boolean(selectedRequest && selectedRole);

  const handleAction = async (actionType) => {
    if (!selectedRequest || !selectedRequest.id || !selectedRole) {
      return;
    }
    setActing(true);
    setError("");
    try {
      const { result } = await apiRequest({
        action: "updateFinanceRequest",
        id: selectedRequest.id,
        requestAction: actionType,
        actorRole: selectedRole,
        actorName: actorName,
        actorNote: actorNote,
      });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      setActorNote("");
      await loadRequests();
      await loadActions(selectedRequest.id);
      await loadActionsByActor();
    } catch (err) {
      setError(err.message || "更新失敗");
    } finally {
      setActing(false);
    }
  };

  const renderRequestRow = (item, extra) => {
    const request = item.request || item;
    const amount = request.type === "purchase" ? request.amountEstimated : request.amountActual;
    return (
      <div
        key={request.id}
        className="rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-600"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{request.title || "未命名"}</p>
            <p className="text-xs text-slate-500">
              {FINANCE_TYPES.find((type) => type.value === request.type)?.label || "申請"} ·{" "}
              {formatFinanceAmount_(amount)} ·{" "}
              {FINANCE_STATUS_LABELS[request.status] || request.status || "-"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{formatDisplayDate_(request.createdAt, { withTime: true })}</span>
            {extra ? extra : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              window.location.href = `/approvals/${request.id}`;
            }}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
          >
            檢視
          </button>
        </div>
      </div>
    );
  };

  if (!googleLinkedStudent || !googleLinkedStudent.email) {
    return (
      <div className={embedded ? "" : "mt-6"}>
        <GoogleSigninPanel
          title="Google 登入"
          helperText="登入後即可查看待簽與已簽清單。"
          onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
        />
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "mt-6"}>
      <div className={embedded ? "" : "rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">簽核中心</h2>
            <p className="mt-1 text-xs text-slate-500">待簽與已簽清單。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            {[
              { id: "pending", label: `待簽 ${pendingItems.length}` },
              { id: "signed", label: `已簽 ${signedItems.length}` },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-full px-4 py-1.5 ${
                  tab === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-xs text-slate-400">載入中...</p>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        {tab === "pending" ? (
          <div className="mt-4 space-y-3">
            {pendingItems.length ? (
              pendingItems.map((item) => renderRequestRow(item))
            ) : (
              <p className="text-sm text-slate-500">目前沒有待簽案件。</p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {signedItems.length ? (
              signedItems.map((item) =>
                renderRequestRow(item, (
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
                    {item.action.action || "已簽"}
                  </span>
                ))
              )
            ) : (
              <p className="text-sm text-slate-500">尚未有簽核紀錄。</p>
            )}
          </div>
        )}
      </div>

      {requestId ? (
        <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
          {selectedRequest ? (
            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedRequest.title || "未命名"}
                </p>
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
                <label className="text-xs font-semibold text-slate-600">審核人</label>
                <input
                  value={actorName}
                  onChange={(event) => setActorName(event.target.value)}
                  placeholder="姓名"
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs text-slate-700"
                />
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
                    disabled={acting}
                    onClick={() => handleAction("approve")}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    核准
                  </button>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleAction("return")}
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    退回
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">目前無可簽核權限或案件已處理。</p>
              )}

              {actions.length ? (
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-xs text-slate-600">
                  <p className="font-semibold text-slate-900">流程紀錄</p>
                  <div className="mt-2 space-y-2">
                    {actions.map((item) => (
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
            <p className="text-sm text-slate-500">找不到這筆簽核案件。</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ApprovalsPage() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const requestId = parts.length >= 2 ? parts[1] : "";
  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            NTU EMBA 115B
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            簽核中心
          </h1>
          <p className="mt-3 text-sm text-slate-500">待簽與已簽清單。</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
        <ApprovalsCenter embedded={false} requestId={requestId} />
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

function FinanceAdminPage() {
  const [requests, setRequests] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [role, setRole] = useState("lead");
  const [actorName, setActorName] = useState("");
  const [actorNote, setActorNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [groupMemberships, setGroupMemberships] = useState([]);
  const [financeRoles, setFinanceRoles] = useState([]);
  const [financeCategories, setFinanceCategories] = useState([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminProfile, setAdminProfile] = useState(null);
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [adminTab, setAdminTab] = useState("requests");
  const [fundEvents, setFundEvents] = useState([]);
  const [fundPayments, setFundPayments] = useState([]);
  const [fundSummary, setFundSummary] = useState(null);
  const [fundEventForm, setFundEventForm] = useState(buildFundEventDraft_());
  const [fundPaymentForm, setFundPaymentForm] = useState(buildFundPaymentDraft_());
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
  const fundPaymentErrorFlags = {
    eventId: !!error && error.includes("班費事件"),
    payerName: !!error && error.includes("繳費人"),
    amount: !!error && error.includes("金額"),
    transferLast5: !!error && error.includes("末 5 碼"),
  };

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
    if (googleLinkedStudent && googleLinkedStudent.email) {
      setAdminEmail(String(googleLinkedStudent.email || "").trim().toLowerCase());
    }
  }, [googleLinkedStudent]);

  useEffect(() => {
    const normalized = String(adminEmail || "").trim().toLowerCase();
    if (!normalized) {
      setAdminProfile(null);
      return;
    }
    const studentMatch =
      students.find((item) => String(item.email || "").trim().toLowerCase() === normalized) ||
      null;
    const personId = String((studentMatch && studentMatch.id) || "").trim();
    const memberships = groupMemberships.filter((item) => {
      if (personId && String(item.personId || "").trim() === personId) {
        return true;
      }
      return String(item.personEmail || "").trim().toLowerCase() === normalized;
    });
    const financeRoleItems = financeRoles.filter((item) => {
      if (personId && String(item.personId || "").trim() === personId) {
        return true;
      }
      return String(item.personEmail || "").trim().toLowerCase() === normalized;
    });
    setAdminProfile({
      personId: personId,
      email: normalized,
      memberships: memberships,
      financeRoles: financeRoleItems,
    });
  }, [adminEmail, students, groupMemberships, financeRoles]);

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
    const name = item.name || item.email || "";
    return {
      id: item.id || "",
      name: name,
      email: String(item.email || "").trim().toLowerCase(),
    };
  });

  const financeGroupMembers = groupMemberships.filter(
    (item) => String(item.groupId || "").trim() === "D"
  );
  const financeMemberIdSet = new Set(
    financeGroupMembers.map((item) => String(item.personId || "").trim()).filter(Boolean)
  );
  const financeMemberEmailSet = new Set(
    financeGroupMembers
      .map((item) => String(item.personEmail || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const financeGroupStudents = students.filter(
    (item) =>
      financeMemberIdSet.has(String(item.id || "").trim()) ||
      financeMemberEmailSet.has(String(item.email || "").trim().toLowerCase())
  );
  const financeGroupFallback = financeGroupMembers.filter((member) => {
    const id = String(member.personId || "").trim();
    const email = String(member.personEmail || "").trim().toLowerCase();
    return !financeMemberIdSet.has(id) && !financeMemberEmailSet.has(email);
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
        email: item.personEmail || "",
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
  const sponsorEmailSet = new Set(
    sponsorMemberships
      .map((item) => String(item.personEmail || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const payerRows = normalizedStudents.map((payer) => {
    const isSponsor =
      sponsorIdSet.has(String(payer.id || "").trim()) ||
      sponsorEmailSet.has(String(payer.email || "").trim().toLowerCase());
    return {
      ...payer,
      payerType: isSponsor ? "sponsor" : "general",
      paid: getPayerStatus_(payer),
    };
  });

  const extraSponsorRows = sponsorMemberships
    .filter((member) => {
      const id = String(member.personId || "").trim();
      const email = String(member.personEmail || "").trim().toLowerCase();
      return (
        (id && !normalizedStudents.some((payer) => String(payer.id || "").trim() === id)) ||
        (email && !normalizedStudents.some((payer) => String(payer.email || "").trim() === email))
      );
    })
    .map((member) => ({
      id: member.personId || "",
      name: member.personName || member.personEmail || member.personId || "",
      email: String(member.personEmail || "").trim().toLowerCase(),
      payerType: "sponsor",
      paid: getPayerStatus_({
        email: String(member.personEmail || "").trim().toLowerCase(),
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

  const hasLeadPrivilege = adminLeadGroups.length || adminDeputyGroups.length;
  const hasRepPrivilege = adminLeadGroups.includes("A");
  const hasCommitteePrivilege = hasLeadPrivilege || hasRepPrivilege || adminDeputyGroups.includes("A");
  const hasAccountingPrivilege = adminRoles.includes("accounting");
  const hasCashierPrivilege = adminRoles.includes("cashier");
  const hasAuditorPrivilege = adminRoles.includes("auditor");

  const availableRoles = [
    hasLeadPrivilege ? "lead" : null,
    hasRepPrivilege ? "rep" : null,
    hasCommitteePrivilege ? "committee" : null,
    hasAccountingPrivilege ? "accounting" : null,
    hasCashierPrivilege ? "cashier" : null,
    hasAuditorPrivilege ? "auditor" : null,
  ].filter((value) => value);

  useEffect(() => {
    if (!availableRoles.length) {
      return;
    }
    if (!availableRoles.includes(role)) {
      setRole(availableRoles[0]);
    }
  }, [availableRoles, role]);

  const filteredRequests = requests.filter((item) => {
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

  const selectedRequest = requests.find((item) => item.id === selectedId) || null;
  const canAct =
    selectedRequest &&
    role !== "auditor" &&
    selectedRequest.status === roleStatusMap[role] &&
    (role !== "lead" ||
      adminLeadGroups.includes(String(selectedRequest.applicantDepartment || "").trim()) ||
      adminDeputyGroups.includes(String(selectedRequest.applicantDepartment || "").trim()));

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
        actorName: actorName,
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
            className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm hover:border-slate-300 sm:inline-flex"
          >
            回首頁
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              {availableRoles.length ? (
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
          <div className="mt-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
            {statusMessage}
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {adminTab === "requests" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
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

          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
                  <label className="text-xs font-semibold text-slate-600">審核人</label>
                  <input
                    value={actorName}
                    onChange={(event) => setActorName(event.target.value)}
                    placeholder="姓名"
                    className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs text-slate-700"
                  />
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
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      退回
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">此角色目前無可核准案件。</p>
                )}

                {actions.length ? (
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-xs text-slate-600">
                    <p className="font-semibold text-slate-900">流程紀錄</p>
                    <div className="mt-2 space-y-2">
                      {actions.map((item) => (
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
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200/70 bg-slate-50/60 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className={`font-semibold ${isActive ? "text-white" : "text-slate-900"}`}>
                                {item.title}
                              </p>
                              <p className={`text-xs ${isActive ? "text-white/70" : "text-slate-500"}`}>
                                {formatDisplayDate_(item.dueDate) || "-"} ·
                                {FUND_EVENT_STATUS.find((status) => status.value === item.status)?.label ||
                                  item.status}
                              </p>
                              <p className={`text-xs ${isActive ? "text-white/70" : "text-slate-500"}`}>
                                目標收款 {formatFinanceAmount_(expectedTotal)}
                              </p>
                              {item.createdById ? (
                                <p className={`text-[11px] ${isActive ? "text-white/70" : "text-slate-400"}`}>
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
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                  isActive
                                    ? "border-white/40 text-white hover:border-white/70"
                                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                編輯
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteFundEvent(item.id);
                                }}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                  isActive
                                    ? "border-white/40 text-white hover:border-white/70"
                                    : "border-rose-200 text-rose-600 hover:border-rose-300"
                                }`}
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
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">收款紀錄</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
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
                              {item.payerName} · {formatFinanceAmount_(item.amount)}
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
                              匯款: {formatDisplayDate_(item.receivedAt) || "-"} · 入帳:{" "}
                              {formatDisplayDate_(item.accountedAt) || "-"}
                            </p>
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
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
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

            <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
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
                  <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4">
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
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
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
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
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
                className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8"
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
                  financeRoles.map((item) => (
                    <div
                      key={item.id || `${item.personId}-${item.role}`}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
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
                            onClick={() => handleEditFinanceRole(item)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFinanceRole(item.id)}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">尚未設定財務角色。</p>
                )}
              </div>
            </div>

            <form
              onSubmit={handleSaveFinanceRole}
              className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8"
            >
              <h3 className="text-lg font-semibold text-slate-900">設定財務角色</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">選擇同學（財會組）</label>
                  <input
                    list="finance-role-students"
                    onChange={(event) => handleSelectFinanceRoleMember_(event.target.value)}
                    placeholder="輸入姓名/學號/Email"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">姓名</label>
                  <input
                    value={financeRoleForm.personName}
                    onChange={(event) => handleFinanceRoleChange("personName", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">角色</label>
                  <select
                    value={financeRoleForm.role}
                    onChange={(event) => handleFinanceRoleChange("role", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                  className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8">
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
                  financeCategories.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
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
                            onClick={() => handleEditFinanceCategory(item)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFinanceCategory(item.id)}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">尚未設定班務性質。</p>
                )}
              </div>
            </div>

            <form
              onSubmit={handleSaveFinanceCategory}
              className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-8"
            >
              <h3 className="text-lg font-semibold text-slate-900">設定班務性質</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">名稱</label>
                  <input
                    value={financeCategoryForm.label}
                    onChange={(event) => handleFinanceCategoryChange("label", event.target.value)}
                    placeholder="例如：全班性的聯誼活動"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">排序</label>
                  <input
                    value={financeCategoryForm.sortOrder}
                    onChange={(event) => handleFinanceCategoryChange("sortOrder", event.target.value)}
                    placeholder="數字越小越前"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                  className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">截止日期</label>
                  <input
                    type="date"
                    value={fundEventForm.dueDate}
                    onChange={(event) => handleFundEventChange("dueDate", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">狀態</label>
                  <select
                    value={fundEventForm.status}
                    onChange={(event) => handleFundEventChange("status", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">班董金額</label>
                  <input
                    value={fundEventForm.amountSponsor}
                    onChange={(event) => handleFundEventChange("amountSponsor", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">預計一般人數</label>
                  <input
                    value={fundEventForm.expectedGeneralCount}
                    onChange={(event) =>
                      handleFundEventChange("expectedGeneralCount", event.target.value)
                    }
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">預計班董人數</label>
                  <input
                    value={fundEventForm.expectedSponsorCount}
                    onChange={(event) =>
                      handleFundEventChange("expectedSponsorCount", event.target.value)
                    }
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                        ? "border-rose-300 bg-rose-50/60"
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
                        ? "border-rose-300 bg-rose-50/60"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                        ? "border-rose-300 bg-rose-50/60"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                          ? "border-rose-300 bg-rose-50/60"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
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
                    className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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
      </main>
    </div>
  );
}

function SoftballPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);
  const [practices, setPractices] = useState([]);
  const [fields, setFields] = useState([]);
  const [gear, setGear] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [softballConfig, setSoftballConfig] = useState({});
  const [jerseyDeadline, setJerseyDeadline] = useState("");
  const [activePracticeId, setActivePracticeId] = useState("");
  const [playerForm, setPlayerForm] = useState({
    id: "",
    name: "",
    nameEn: "",
    preferredName: "",
    email: "",
    phone: "",
    jerseyNumber: "",
    nickname: "",
    positions: "",
    bats: "",
    throws: "",
    role: "",
    status: "active",
    jerseyRequest: "",
    positionRequest: "",
    requestStatus: "",
    notes: "",
  });
  const [practiceForm, setPracticeForm] = useState({
    id: "",
    date: "",
    startAt: "",
    endAt: "",
    fieldId: "",
    title: "",
    focus: "",
    logSummary: "",
    nextPlan: "",
    status: "scheduled",
    notes: "",
  });
  const [fieldForm, setFieldForm] = useState({
    id: "",
    name: "",
    address: "",
    mapUrl: "",
    parking: "",
    fee: "",
    notes: "",
  });
  const [gearForm, setGearForm] = useState({
    id: "",
    name: "",
    category: "",
    quantity: "",
    owner: "",
    status: "available",
    notes: "",
  });
  const [playerQuery, setPlayerQuery] = useState("");
  const [attendanceNoteMap, setAttendanceNoteMap] = useState({});
  const [practicesUpdatedAt, setPracticesUpdatedAt] = useState(null);
  const [practiceRefreshing, setPracticeRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [loginExpanded, setLoginExpanded] = useState(false);

  const POSITION_OPTIONS = ["投手", "捕手", "一壘", "二壘", "三壘", "游擊", "左外野", "中外野", "右外野", "拉拉隊", "球隊經理"];
  const ROLE_OPTIONS = ["隊長", "副隊長", "器材", "出勤", "後勤", "教練"];

  const normalizeId_ = (value) => String(value || "").trim();

  const isTimeOnly_ = (value) => {
    if (!value) {
      return false;
    }
    const raw = String(value).trim();
    return /^\d{1,2}:\d{2}$/.test(raw) || /^\d{1,2}:\d{2}:\d{2}$/.test(raw);
  };

  const isSentinelDate_ = (value) => {
    if (!value) {
      return false;
    }
    const raw = String(value).trim();
    const match = raw.match(/(\d{4})[-/]\d{1,2}[-/]\d{1,2}/);
    if (!match) {
      return false;
    }
    const year = Number(match[1]);
    return year > 0 && year <= 1900;
  };

  const getDatePartsFromValue_ = (value) => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return {
        year: value.getFullYear(),
        month: value.getMonth() + 1,
        day: value.getDate(),
      };
    }
    if (typeof value === "number") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime())
        ? null
        : {
            year: parsed.getFullYear(),
            month: parsed.getMonth() + 1,
            day: parsed.getDate(),
          };
    }
    const raw = String(value).trim();
    const dateOnlyMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      return year && month && day ? { year, month, day } : null;
    }
    if (isSentinelDate_(raw)) {
      return null;
    }
    if (/T/.test(raw) && (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw))) {
      const parsed = new Date(raw);
      return isNaN(parsed.getTime())
        ? null
        : {
            year: parsed.getFullYear(),
            month: parsed.getMonth() + 1,
            day: parsed.getDate(),
          };
    }
    const match = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!match) {
      return null;
    }
    if (isSentinelDate_(match[0])) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || !month || !day) {
      return null;
    }
    return { year, month, day };
  };

  const getTimePartsFromValue_ = (value) => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return { hour: value.getHours(), minute: value.getMinutes() };
    }
    if (typeof value === "number") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime())
        ? null
        : { hour: parsed.getHours(), minute: parsed.getMinutes() };
    }
    const raw = String(value).trim();
    const ampmMatch = raw.match(/(上午|下午)\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (ampmMatch) {
      let hour = Number(ampmMatch[2]);
      const minute = Number(ampmMatch[3]);
      if (ampmMatch[1] === "下午" && hour < 12) {
        hour += 12;
      }
      if (ampmMatch[1] === "上午" && hour === 12) {
        hour = 0;
      }
      return { hour, minute };
    }
    if (isSentinelDate_(raw)) {
      if (/T/.test(raw) && (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw))) {
        const parsed = new Date(raw);
        return isNaN(parsed.getTime())
          ? null
          : { hour: parsed.getHours(), minute: parsed.getMinutes() };
      }
      const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) {
        return null;
      }
      return { hour: Number(timeMatch[1]), minute: Number(timeMatch[2]) };
    }
    const match = raw.match(/(\d{1,2}):(\d{2})/);
    if (!match) {
      return null;
    }
    return { hour: Number(match[1]), minute: Number(match[2]) };
  };

  const formatDateParts_ = (parts) => {
    if (!parts) {
      return "";
    }
    return `${parts.year}-${pad2_(parts.month)}-${pad2_(parts.day)}`;
  };

  const getPracticeSortKey_ = (practice) => {
    const dateParts = getDatePartsFromValue_(practice.date) || getDatePartsFromValue_(practice.startAt);
    if (!dateParts) {
      return Number.POSITIVE_INFINITY;
    }
    const timeParts = getTimePartsFromValue_(practice.startAt) || { hour: 0, minute: 0 };
    const dateKey = dateParts.year * 10000 + dateParts.month * 100 + dateParts.day;
    const timeKey =
      pad2_(timeParts.hour) === "00" && pad2_(timeParts.minute) === "00"
        ? 0
        : timeParts.hour * 100 + timeParts.minute;
    return dateKey * 10000 + timeKey;
  };

  const getPracticeDayKey_ = (practice) => {
    const dateParts = getDatePartsFromValue_(practice.date) || getDatePartsFromValue_(practice.startAt);
    if (!dateParts) {
      return Number.POSITIVE_INFINITY;
    }
    return dateParts.year * 10000 + dateParts.month * 100 + dateParts.day;
  };

  const toDateInputValueFromValue_ = (value) => {
    const parts = getDatePartsFromValue_(value);
    return parts ? formatDateParts_(parts) : "";
  };

  const toTimeInputValueFromValue_ = (value) => {
    const parts = getTimePartsFromValue_(value);
    if (!parts) {
      return "";
    }
    return `${pad2_(parts.hour)}:${pad2_(parts.minute)}`;
  };

  const getPracticeListTimeLabel_ = (practice) => {
    const start = toTimeInputValueFromValue_(practice.startAt);
    const end = toTimeInputValueFromValue_(practice.endAt);
    if (!start && !end) {
      return "";
    }
    return `${start || "-"} - ${end || "-"}`;
  };

  const formatDatePartsWithWeekday_ = (parts) => {
    if (!parts) {
      return "-";
    }
    const dateLocal = new Date(parts.year, parts.month - 1, parts.day);
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][dateLocal.getDay()];
    return `${parts.year}/${pad2_(parts.month)}/${pad2_(parts.day)} (週${weekday})`;
  };

  const formatPracticeDate_ = (value) => {
    const parts = getDatePartsFromValue_(value);
    if (parts) {
      return formatDatePartsWithWeekday_(parts);
    }
    return formatDisplayDate_(value) || "-";
  };

  const loadPlayers = async () => {
    try {
      const { result } = await apiRequest({ action: "listSoftballPlayers" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setPlayers(result.data && result.data.players ? result.data.players : []);
    } catch (err) {
      setError("球員資料載入失敗。");
    }
  };

  const loadPractices = async () => {
    try {
      const { result } = await apiRequest({ action: "listSoftballPractices" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const list = result.data && result.data.practices ? result.data.practices : [];
      const sorted = list.slice().sort((a, b) => getPracticeSortKey_(a) - getPracticeSortKey_(b));
      setPractices(sorted);
    } catch (err) {
      setError("練習資料載入失敗。");
    }
  };

  const loadFields = async () => {
    try {
      const { result } = await apiRequest({ action: "listSoftballFields" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setFields(result.data && result.data.fields ? result.data.fields : []);
    } catch (err) {
      setError("球場資料載入失敗。");
    }
  };

  const loadGear = async () => {
    try {
      const { result } = await apiRequest({ action: "listSoftballGear" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setGear(result.data && result.data.gear ? result.data.gear : []);
    } catch (err) {
      setError("器材資料載入失敗。");
    }
  };

  const loadAttendance = async (practiceId) => {
    if (!practiceId) {
      setAttendance([]);
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "listSoftballAttendance",
        practiceId: practiceId,
      });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setAttendance(result.data && result.data.attendance ? result.data.attendance : []);
    } catch (err) {
      setError("出席資料載入失敗。");
    }
  };

  const loadSoftballConfig = async () => {
    try {
      const { result } = await apiRequest({ action: "listSoftballConfig" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const config = result.data && result.data.config ? result.data.config : {};
      setSoftballConfig(config);
      setJerseyDeadline(config.jerseyDeadline || "");
    } catch (err) {
      setSoftballConfig({});
    }
  };

  const loadSoftballBootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listSoftballBootstrap" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const data = result.data || {};
      setPlayers(data.players || []);
      const practiceList = data.practices || [];
      const sorted = practiceList
        .slice()
        .sort((a, b) => getPracticeSortKey_(a) - getPracticeSortKey_(b));
      setPractices(sorted);
      setFields(data.fields || []);
      setGear(data.gear || []);
      const config = data.config || {};
      setSoftballConfig(config);
      setJerseyDeadline(config.jerseyDeadline || "");
      return true;
    } catch (err) {
      setError(err.message || "載入失敗");
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const loadAll = async () => {
      const ok = await loadSoftballBootstrap();
      if (!ok) {
        setLoading(true);
        setError("");
        try {
          await Promise.all([
            loadPlayers(),
            loadPractices(),
            loadFields(),
            loadGear(),
            loadSoftballConfig(),
          ]);
        } finally {
          if (!ignore) {
            setLoading(false);
          }
        }
      }
    };
    loadAll();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (activePracticeId) {
      loadAttendance(activePracticeId);
    }
  }, [activePracticeId]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayKey =
    todayStart.getFullYear() * 10000 + (todayStart.getMonth() + 1) * 100 + todayStart.getDate();
  const nextPractice =
    practices.find((practice) => getPracticeDayKey_(practice) >= todayKey) || practices[0] || null;
  const selectedPractice =
    practices.find((practice) => normalizeId_(practice.id) === normalizeId_(activePracticeId)) ||
    null;

  useEffect(() => {
    if (!activePracticeId && practices.length) {
      setActivePracticeId(normalizeId_(nextPractice ? nextPractice.id : practices[0].id));
    }
  }, [activePracticeId, nextPractice, practices]);

  useEffect(() => {
    const selected = practices.find((item) => normalizeId_(item.id) === normalizeId_(activePracticeId));
    if (selected) {
      setPracticeForm({
        id: selected.id || "",
        date: toDateInputValueFromValue_(selected.date || selected.startAt),
        startAt: toTimeInputValueFromValue_(selected.startAt),
        endAt: toTimeInputValueFromValue_(selected.endAt),
        fieldId: selected.fieldId || "",
        title: selected.title || "",
        focus: selected.focus || "",
        logSummary: selected.logSummary || "",
        nextPlan: selected.nextPlan || "",
        status: selected.status || "scheduled",
        notes: selected.notes || "",
      });
    }
  }, [activePracticeId, practices]);

  const handlePlayerFormChange = (key, value) => {
    setPlayerForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePracticeFormChange = (key, value) => {
    setPracticeForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFieldFormChange = (key, value) => {
    setFieldForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleGearFormChange = (key, value) => {
    setGearForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetPlayerForm = () => {
    setPlayerForm({
      id: "",
      name: "",
      nameEn: "",
      preferredName: "",
      email: "",
      phone: "",
      jerseyNumber: "",
      nickname: "",
      jerseyChoices: "",
      positions: "",
      bats: "",
      throws: "",
      role: "",
      status: "active",
      jerseyRequest: "",
      positionRequest: "",
      requestStatus: "",
      notes: "",
    });
  };

  const handleSaveConfig = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await apiRequest({
        action: "updateSoftballConfig",
        data: {
          jerseyDeadline: jerseyDeadline,
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      setSoftballConfig(result.data && result.data.config ? result.data.config : {});
      setStatusMessage("已更新背號截止日");
    } catch (err) {
      setStatusMessage(err.message || "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const resetPracticeForm = () => {
    setPracticeForm({
      id: "",
      date: "",
      startAt: "",
      endAt: "",
      fieldId: "",
      title: "",
      focus: "",
      logSummary: "",
      nextPlan: "",
      status: "scheduled",
      notes: "",
    });
  };

  const resetFieldForm = () => {
    setFieldForm({
      id: "",
      name: "",
      address: "",
      mapUrl: "",
      parking: "",
      fee: "",
      notes: "",
    });
  };

  const resetGearForm = () => {
    setGearForm({
      id: "",
      name: "",
      category: "",
      quantity: "",
      owner: "",
      status: "available",
      notes: "",
    });
  };

  const handleReviewRequest = async (player, decision) => {
    if (!player || !player.id) {
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const payload = {
        id: player.id,
        requestStatus: decision,
      };
      if (decision === "approved") {
        if (player.jerseyRequest) {
          payload.jerseyNumber = player.jerseyRequest;
          payload.jerseyRequest = "";
        }
        if (player.positionRequest) {
          payload.positions = player.positionRequest;
          payload.positionRequest = "";
        }
      }
      if (decision === "rejected") {
        payload.jerseyRequest = player.jerseyRequest || "";
        payload.positionRequest = player.positionRequest || "";
      }
      const { result } = await apiRequest({ action: "updateSoftballPlayer", data: payload });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      await loadPlayers();
      setStatusMessage(decision === "approved" ? "已核准申請" : "已退回申請");
    } catch (err) {
      setStatusMessage(err.message || "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlayer = async (event) => {
    event.preventDefault();
    if (!playerForm.id) {
      setStatusMessage("請先填學號/ID");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const action = players.find((item) => normalizeId_(item.id) === normalizeId_(playerForm.id))
        ? "updateSoftballPlayer"
        : "createSoftballPlayer";
      const { result } = await apiRequest({ action: action, data: playerForm });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      await loadPlayers();
      setStatusMessage("已更新球員資料");
      resetPlayerForm();
    } catch (err) {
      setStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePractice = async (event) => {
    event.preventDefault();
    if (!practiceForm.date) {
      setStatusMessage("請先選日期");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const action = practiceForm.id ? "updateSoftballPractice" : "createSoftballPractice";
      const payload = practiceForm.id
        ? { action: action, id: practiceForm.id, data: practiceForm }
        : { action: action, data: practiceForm };
      const { result } = await apiRequest(payload);
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      await loadPractices();
      if (result.data && result.data.practice && result.data.practice.id) {
        setActivePracticeId(result.data.practice.id);
      }
      setStatusMessage("已更新練習");
    } catch (err) {
      setStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveField = async (event) => {
    event.preventDefault();
    if (!fieldForm.name) {
      setStatusMessage("請先填球場名稱");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const action = fieldForm.id ? "updateSoftballField" : "createSoftballField";
      const payload = fieldForm.id
        ? { action: action, id: fieldForm.id, data: fieldForm }
        : { action: action, data: fieldForm };
      const { result } = await apiRequest(payload);
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      await loadFields();
      setStatusMessage("已更新球場");
      resetFieldForm();
    } catch (err) {
      setStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGear = async (event) => {
    event.preventDefault();
    if (!gearForm.name) {
      setStatusMessage("請先填器材名稱");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const action = gearForm.id ? "updateSoftballGear" : "createSoftballGear";
      const payload = gearForm.id
        ? { action: action, id: gearForm.id, data: gearForm }
        : { action: action, data: gearForm };
      const { result } = await apiRequest(payload);
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      await loadGear();
      setStatusMessage("已更新器材");
      resetGearForm();
    } catch (err) {
      setStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlayer = async (id) => {
    if (!id) {
      return;
    }
    const playerLabel =
      players.find((item) => normalizeId_(item.id) === normalizeId_(id))?.name || id;
    if (!confirmDelete_(`確定要刪除球員「${playerLabel}」嗎？此動作無法復原。`)) {
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await apiRequest({ action: "deleteSoftballPlayer", id: id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadPlayers();
      setStatusMessage("已刪除球員");
    } catch (err) {
      setStatusMessage(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePractice = async (id) => {
    if (!id) {
      return;
    }
    const practiceLabel =
      practices.find((item) => normalizeId_(item.id) === normalizeId_(id))?.title || id;
    if (!confirmDelete_(`確定要刪除練習「${practiceLabel}」嗎？此動作無法復原。`)) {
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await apiRequest({ action: "deleteSoftballPractice", id: id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadPractices();
      setStatusMessage("已刪除練習");
      if (activePracticeId === id) {
        setActivePracticeId("");
      }
    } catch (err) {
      setStatusMessage(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (id) => {
    if (!id) {
      return;
    }
    const fieldLabel =
      fields.find((item) => normalizeId_(item.id) === normalizeId_(id))?.name || id;
    if (!confirmDelete_(`確定要刪除場地「${fieldLabel}」嗎？此動作無法復原。`)) {
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await apiRequest({ action: "deleteSoftballField", id: id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadFields();
      setStatusMessage("已刪除球場");
    } catch (err) {
      setStatusMessage(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGear = async (id) => {
    if (!id) {
      return;
    }
    const gearLabel =
      gear.find((item) => normalizeId_(item.id) === normalizeId_(id))?.name || id;
    if (!confirmDelete_(`確定要刪除器材「${gearLabel}」嗎？此動作無法復原。`)) {
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await apiRequest({ action: "deleteSoftballGear", id: id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadGear();
      setStatusMessage("已刪除器材");
    } catch (err) {
      setStatusMessage(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleAttendanceStatus = async (studentId, status) => {
    if (!activePracticeId) {
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await apiRequest({
        action: "submitSoftballAttendance",
        data: {
          practiceId: activePracticeId,
          studentId: studentId,
          status: status,
          note: String(attendanceNoteMap[studentId] || "").trim(),
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      await loadAttendance(activePracticeId);
    } catch (err) {
      setStatusMessage(err.message || "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const filteredPlayers = players.filter((player) => {
    if (!playerQuery) {
      return true;
    }
    const needle = String(playerQuery).trim().toLowerCase();
    const haystack = [
      player.id,
      player.name,
      player.nameEn,
      player.preferredName,
      player.nickname,
      player.email,
      player.jerseyNumber,
      player.positions,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(needle);
  });

  const pendingRequests = players.filter(
    (player) => String(player.requestStatus || "").toLowerCase() === "pending"
  );

  const attendanceByStudent = attendance.reduce((acc, item) => {
    const key = normalizeId_(item.studentId);
    if (key) {
      acc[key] = item;
    }
    return acc;
  }, {});

  const attendanceStats = attendance.reduce(
    (acc, item) => {
      const status = String(item.status || "").toLowerCase();
      if (status === "attend") {
        acc.attend += 1;
      } else if (status === "late") {
        acc.late += 1;
      } else if (status === "absent") {
        acc.absent += 1;
      } else {
        acc.unknown += 1;
      }
      acc.total += 1;
      return acc;
    },
    { total: 0, attend: 0, late: 0, absent: 0, unknown: 0 }
  );

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            NTU EMBA 115B
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">壘球隊管理</h1>
          <p className="mt-3 text-sm text-slate-500">
            職業等級的隊務管理：球員、練習、場地、出席、器材與日誌。
          </p>
        </div>
      </header>
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
                helperText="登入後可點名與更新球員資訊。"
                onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
              />
            </div>
          ) : null}
        </section>
        <section className="mb-6 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-6">
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
            {[
              { id: "overview", label: "總覽" },
              { id: "practices", label: "練習排程" },
              { id: "attendance", label: "點名" },
              { id: "players", label: "球員" },
              { id: "fields", label: "球場" },
              { id: "gear", label: "器材" },
              { id: "stats", label: "統計" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`rounded-xl px-4 py-2 ${
                  activeTab === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {statusMessage ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
            {statusMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {activeTab === "overview" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "球員人數", value: players.length },
                { label: "練習場次", value: practices.length },
                { label: "球場數", value: fields.length },
                { label: "器材項目", value: gear.length },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">下一次練習</p>
                {nextPractice ? (
                  <p className="mt-3">
                    {formatPracticeDate_(nextPractice.date)} · {nextPractice.title || "練習"}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">尚未安排練習。</p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">管理提醒</p>
                <p className="mt-3 text-xs text-slate-500">
                  請至「點名」分頁更新出席狀態與備註。
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "practices" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">練習列表</h3>
                  <button
                    onClick={resetPracticeForm}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    新增
                  </button>
                </div>
                <div className="space-y-2">
                  {practices.length ? (
                    practices.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActivePracticeId(normalizeId_(item.id))}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          normalizeId_(activePracticeId) === normalizeId_(item.id)
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <p className="font-semibold">
                            {formatPracticeDate_(toDateInputValueFromValue_(item.date || item.startAt))}
                          </p>
                          <p className="text-xs opacity-70">
                            {item.title || "練習"} · {item.status || "scheduled"}
                            {getPracticeListTimeLabel_(item) ? ` · ${getPracticeListTimeLabel_(item)}` : ""}
                          </p>
                        </div>
                        <span className="text-xs opacity-70">{item.id}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">尚未建立練習。</p>
                  )}
                </div>
              </div>
              <form onSubmit={handleSavePractice} className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">日期</label>
                  <input
                    type="date"
                    value={practiceForm.date}
                    onChange={(event) => handlePracticeFormChange("date", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">開始時間</label>
                    <input
                      type="time"
                      value={practiceForm.startAt}
                      onChange={(event) => handlePracticeFormChange("startAt", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">結束時間</label>
                    <input
                      type="time"
                      value={practiceForm.endAt}
                      onChange={(event) => handlePracticeFormChange("endAt", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">球場</label>
                  <select
                    value={practiceForm.fieldId}
                    onChange={(event) => handlePracticeFormChange("fieldId", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  >
                    <option value="">選擇球場</option>
                    {fields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">標題</label>
                  <input
                    value={practiceForm.title}
                    onChange={(event) => handlePracticeFormChange("title", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">練習重點</label>
                  <input
                    value={practiceForm.focus}
                    onChange={(event) => handlePracticeFormChange("focus", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">練習日誌</label>
                  <textarea
                    value={practiceForm.logSummary}
                    onChange={(event) => handlePracticeFormChange("logSummary", event.target.value)}
                    rows="3"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">下次計畫</label>
                  <textarea
                    value={practiceForm.nextPlan}
                    onChange={(event) => handlePracticeFormChange("nextPlan", event.target.value)}
                    rows="2"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">狀態</label>
                    <select
                      value={practiceForm.status}
                      onChange={(event) => handlePracticeFormChange("status", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    >
                      <option value="scheduled">已排程</option>
                      <option value="closed">結束</option>
                      <option value="cancelled">取消</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">備註</label>
                    <input
                      value={practiceForm.notes}
                      onChange={(event) => handlePracticeFormChange("notes", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "儲存中..." : practiceForm.id ? "更新練習" : "新增練習"}
                  </button>
                  {practiceForm.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeletePractice(practiceForm.id)}
                      className="rounded-2xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 hover:border-rose-300"
                    >
                      刪除
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </section>
        ) : null}

        {activeTab === "attendance" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">練習點名</h3>
                <p className="text-xs text-slate-500">
                  {activePracticeId ? `練習編號 ${activePracticeId}` : "請選擇練習"}
                </p>
              </div>
              <select
                value={activePracticeId}
                onChange={(event) => setActivePracticeId(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              >
                <option value="">選擇練習</option>
                {practices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatPracticeDate_(toDateInputValueFromValue_(item.date || item.startAt))}
                    {getPracticeListTimeLabel_(item) ? ` ${getPracticeListTimeLabel_(item)}` : ""}
                    {` · ${item.title || "練習"}`}
                  </option>
                ))}
              </select>
            </div>

            {selectedPractice ? (
              <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">
                  {formatPracticeDate_(toDateInputValueFromValue_(selectedPractice.date || selectedPractice.startAt))}
                </span>
                {getPracticeListTimeLabel_(selectedPractice)
                  ? ` · ${getPracticeListTimeLabel_(selectedPractice)}`
                  : ""}
                {selectedPractice.fieldId
                  ? ` · ${fields.find((field) => normalizeId_(field.id) === normalizeId_(selectedPractice.fieldId))?.name || "未命名球場"}`
                  : ""}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              {[
                { label: "出席", value: attendanceStats.attend },
                { label: "遲到", value: attendanceStats.late },
                { label: "缺席", value: attendanceStats.absent },
                { label: "未回覆", value: attendanceStats.unknown },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {filteredPlayers.length ? (
                filteredPlayers.map((player) => {
                  const record = attendanceByStudent[normalizeId_(player.id)] || {};
                  const currentStatus = String(record.status || "unknown").toLowerCase();
                  return (
                    <div
                      key={player.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {player.name || player.id || "-"}
                          {player.nickname ? ` · ${player.nickname}` : ""}
                          {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {player.positions || "-"} · {player.role || "球員"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { value: "attend", label: "出席" },
                          { value: "late", label: "遲到" },
                          { value: "absent", label: "缺席" },
                          { value: "unknown", label: "未定" },
                        ].map((item) => (
                          <button
                            key={`${player.id}-${item.value}`}
                            onClick={() => handleAttendanceStatus(player.id, item.value)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              currentStatus === item.value
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                        <input
                          value={attendanceNoteMap[player.id] || record.note || ""}
                          onChange={(event) =>
                            setAttendanceNoteMap((prev) => ({ ...prev, [player.id]: event.target.value }))
                          }
                          placeholder="備註"
                          className="h-8 w-40 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400">尚未建立球員。</p>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "players" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-900">球員管理</h3>
              <input
                value={playerQuery}
                onChange={(event) => setPlayerQuery(event.target.value)}
                placeholder="搜尋姓名、學號、背號、暱稱"
                className="h-10 w-56 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3">
                {pendingRequests.length ? (
                  <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 text-xs text-amber-700">
                    <p className="font-semibold text-amber-900">待審核申請</p>
                    <div className="mt-2 space-y-2">
                      {pendingRequests.map((player) => (
                        <div
                          key={`pending-${player.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/70 bg-white px-3 py-2"
                        >
                          <span className="font-semibold text-slate-800">
                            {player.name || player.id || "-"}
                            {player.nickname ? ` · ${player.nickname}` : ""}
                            {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}
                          </span>
                          <span className="text-amber-700">
                            背號：{player.jerseyRequest || "-"} · 位置：
                            {player.positionRequest || "-"}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReviewRequest(player, "approved")}
                              className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 hover:border-emerald-300"
                            >
                              核准
                            </button>
                            <button
                              onClick={() => handleReviewRequest(player, "rejected")}
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
                            >
                              退回
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">背號截止日</p>
                    <form onSubmit={handleSaveConfig} className="flex items-center gap-2">
                      <input
                        type="date"
                        value={jerseyDeadline}
                        onChange={(event) => setJerseyDeadline(event.target.value)}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        儲存
                      </button>
                    </form>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    截止日前號碼為暫時保留，截止後由隊務一次核准。
                  </p>
                </div>
                {filteredPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setPlayerForm({
                            ...player,
                            jerseyChoices: player.jerseyChoices || "",
                            requestStatus: player.requestStatus || "",
                            jerseyRequest: player.jerseyRequest || "",
                            positionRequest: player.positionRequest || "",
                            phone: normalizePhoneInputValue_(player.phone),
                          })
                        }
                        className="flex-1 text-left"
                      >
                        <p className="font-semibold text-slate-900">
                          {player.name || player.id || "-"}
                          {player.nickname ? ` · ${player.nickname}` : ""}
                          {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {player.positions || "-"} · {player.role || "球員"}
                        </p>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeletePlayer(player.id)}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSavePlayer} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">中文姓名</label>
                    <input
                      value={playerForm.name}
                      onChange={(event) => handlePlayerFormChange("name", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">球員暱稱</label>
                    <input
                      value={playerForm.nickname}
                      onChange={(event) => handlePlayerFormChange("nickname", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">聯絡電話</label>
              <input
                value={playerForm.phone}
                onChange={(event) => handlePlayerFormChange("phone", event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">背號</label>
              <input
                value={playerForm.jerseyNumber}
                onChange={(event) => handlePlayerFormChange("jerseyNumber", event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              />
            </div>
          </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">守備位置</label>
                  <div className="flex flex-wrap gap-2">
                    {POSITION_OPTIONS.map((item) => {
                      const current = String(playerForm.positions || "");
                      const active = current.split(",").map((value) => value.trim()).includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            const selected = current
                              ? current.split(",").map((value) => value.trim()).filter(Boolean)
                              : [];
                            const next = active
                              ? selected.filter((value) => value !== item)
                              : selected.concat(item);
                            handlePlayerFormChange("positions", next.join(", "));
                          }}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">打擊</label>
                    <select
                      value={playerForm.bats}
                      onChange={(event) => handlePlayerFormChange("bats", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    >
                      <option value="">未設定</option>
                      <option value="R">右打</option>
                      <option value="L">左打</option>
                      <option value="S">左右開弓</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">投球/傳球</label>
                    <select
                      value={playerForm.throws}
                      onChange={(event) => handlePlayerFormChange("throws", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    >
                      <option value="">未設定</option>
                      <option value="R">右投</option>
                      <option value="L">左投</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">角色</label>
                    <select
                      value={playerForm.role}
                      onChange={(event) => handlePlayerFormChange("role", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    >
                      <option value="">球員</option>
                      {ROLE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">狀態</label>
                    <select
                      value={playerForm.status}
                      onChange={(event) => handlePlayerFormChange("status", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    >
                      <option value="active">可出席</option>
                      <option value="injured">傷兵</option>
                      <option value="inactive">暫停</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">備註</label>
                  <textarea
                    value={playerForm.notes}
                    onChange={(event) => handlePlayerFormChange("notes", event.target.value)}
                    rows="3"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "儲存中..." : "儲存球員"}
                  </button>
                  <button
                    type="button"
                    onClick={resetPlayerForm}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    清空
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        {activeTab === "fields" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                {fields.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.address || "-"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFieldForm({ ...item })}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleDeleteField(item.id)}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSaveField} className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">球場名稱</label>
                  <input
                    value={fieldForm.name}
                    onChange={(event) => handleFieldFormChange("name", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">地址</label>
                  <input
                    value={fieldForm.address}
                    onChange={(event) => handleFieldFormChange("address", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">地圖連結</label>
                  <input
                    value={fieldForm.mapUrl}
                    onChange={(event) => handleFieldFormChange("mapUrl", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">停車</label>
                    <input
                      value={fieldForm.parking}
                      onChange={(event) => handleFieldFormChange("parking", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">費用</label>
                    <input
                      value={fieldForm.fee}
                      onChange={(event) => handleFieldFormChange("fee", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">備註</label>
                  <textarea
                    value={fieldForm.notes}
                    onChange={(event) => handleFieldFormChange("notes", event.target.value)}
                    rows="3"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "儲存中..." : "儲存球場"}
                  </button>
                  <button
                    type="button"
                    onClick={resetFieldForm}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    清空
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        {activeTab === "gear" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                {gear.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.category || "-"} · {item.quantity || "0"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setGearForm({ ...item })}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleDeleteGear(item.id)}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSaveGear} className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">器材名稱</label>
                  <input
                    value={gearForm.name}
                    onChange={(event) => handleGearFormChange("name", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">分類</label>
                    <input
                      value={gearForm.category}
                      onChange={(event) => handleGearFormChange("category", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">數量</label>
                    <input
                      value={gearForm.quantity}
                      onChange={(event) => handleGearFormChange("quantity", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">保管人</label>
                    <input
                      value={gearForm.owner}
                      onChange={(event) => handleGearFormChange("owner", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">狀態</label>
                    <select
                      value={gearForm.status}
                      onChange={(event) => handleGearFormChange("status", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    >
                      <option value="available">可用</option>
                      <option value="borrowed">借出</option>
                      <option value="repair">維修</option>
                      <option value="lost">遺失</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">備註</label>
                  <textarea
                    value={gearForm.notes}
                    onChange={(event) => handleGearFormChange("notes", event.target.value)}
                    rows="3"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "儲存中..." : "儲存器材"}
                  </button>
                  <button
                    type="button"
                    onClick={resetGearForm}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    清空
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        {activeTab === "stats" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <h3 className="text-lg font-semibold text-slate-900">出席統計</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "總出席", value: attendanceStats.attend },
                { label: "遲到", value: attendanceStats.late },
                { label: "缺席", value: attendanceStats.absent },
                { label: "未回覆", value: attendanceStats.unknown },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-5 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">備註</p>
              <p className="mt-2 text-xs text-slate-500">
                統計基於目前選擇的練習。後續可加入跨場次出席率與球員歷史趨勢。
              </p>
            </div>
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

function SoftballPlayerPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [players, setPlayers] = useState([]);
  const [practices, setPractices] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fields, setFields] = useState([]);
  const [softballConfig, setSoftballConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [loginExpanded, setLoginExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [practicesUpdatedAt, setPracticesUpdatedAt] = useState(null);
  const [practiceRefreshing, setPracticeRefreshing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    id: "",
    name: "",
    preferredName: "",
    email: "",
    phone: "",
    nickname: "",
    bats: "",
    throws: "",
    positions: "",
    jerseyChoices: "",
    jerseyRequest: "",
    positionRequest: "",
    notes: "",
  });
  const [attendanceNoteMap, setAttendanceNoteMap] = useState({});

  const POSITION_OPTIONS = ["投手", "捕手", "一壘", "二壘", "三壘", "游擊", "左外野", "中外野", "右外野", "拉拉隊", "球隊經理"];

  const normalizeId_ = (value) => String(value || "").trim();

  const formatJerseyLabel_ = (value) => {
    if (!value) {
      return "";
    }
    return String(value).padStart(2, "0");
  };

  const jerseyNumbers = Array.from({ length: 100 }, (_, index) => formatJerseyLabel_(String(index)));

  const loadPlayers = async () => {
    const { result } = await apiRequest({ action: "listSoftballPlayers" });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    setPlayers(result.data && result.data.players ? result.data.players : []);
  };

  const loadPractices = async () => {
    const { result } = await apiRequest({ action: "listSoftballPractices" });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    const list = result.data && result.data.practices ? result.data.practices : [];
    const sorted = list.slice().sort((a, b) => String(b.date || "").localeCompare(a.date || ""));
    setPractices(sorted);
    setPracticesUpdatedAt(new Date());
  };

  const loadFields = async () => {
    const { result } = await apiRequest({ action: "listSoftballFields" });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    setFields(result.data && result.data.fields ? result.data.fields : []);
  };

  const loadAttendance = async (studentId) => {
    if (!studentId) {
      setAttendance([]);
      return;
    }
    const { result } = await apiRequest({ action: "listSoftballAttendance" });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    const list = result.data && result.data.attendance ? result.data.attendance : [];
    setAttendance(list.filter((item) => normalizeId_(item.studentId) === normalizeId_(studentId)));
  };

  useEffect(() => {
    let ignore = false;
    const loadAll = async () => {
      setLoading(true);
      setError("");
      try {
        await loadPlayers();
        await loadPractices();
        await loadFields();
        const { result } = await apiRequest({ action: "listSoftballConfig" });
        if (result.ok) {
          setSoftballConfig(result.data && result.data.config ? result.data.config : {});
        }
      } catch (err) {
        if (!ignore) {
          setError("壘球資料載入失敗。");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    loadAll();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (googleLinkedStudent && googleLinkedStudent.id) {
      loadAttendance(googleLinkedStudent.id);
    }
  }, [googleLinkedStudent]);

  const handleRefreshPractices = async () => {
    if (practiceRefreshing) {
      return;
    }
    setPracticeRefreshing(true);
    try {
      await Promise.all([
        loadPractices(),
        loadFields(),
        googleLinkedStudent && googleLinkedStudent.id
          ? loadAttendance(googleLinkedStudent.id)
          : Promise.resolve(),
      ]);
    } finally {
      setPracticeRefreshing(false);
    }
  };

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.id) {
      return;
    }
    const match = players.find(
      (item) => normalizeId_(item.id) === normalizeId_(googleLinkedStudent.id)
    );
    if (match) {
      const normalizedJersey = match.jerseyNumber
        ? formatJerseyLabel_(String(match.jerseyNumber))
        : "";
      setProfileForm({
        id: match.id || googleLinkedStudent.id,
        name: match.name || googleLinkedStudent.name || "",
        preferredName: match.preferredName || googleLinkedStudent.preferredName || "",
        email: match.email || googleLinkedStudent.email || "",
        phone: match.phone || "",
        nickname: match.nickname || "",
        bats: match.bats || "",
        throws: match.throws || "",
        positions: match.positions || "",
        jerseyChoices: match.jerseyChoices || "",
        jerseyRequest: match.jerseyRequest || normalizedJersey || "",
        positionRequest: match.positionRequest || match.positions || "",
        notes: match.notes || "",
      });
    } else {
      setProfileForm((prev) => ({
        ...prev,
        id: googleLinkedStudent.id,
        name: googleLinkedStudent.name || "",
        preferredName: googleLinkedStudent.preferredName || "",
        email: googleLinkedStudent.email || "",
        nickname: "",
      }));
    }
  }, [players, googleLinkedStudent]);

  const handleProfileChange = (key, value) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitProfile = async (event) => {
    event.preventDefault();
    if (!googleLinkedStudent || !googleLinkedStudent.id) {
      setStatusMessage("請先登入 Google");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const exists = players.some(
        (item) => normalizeId_(item.id) === normalizeId_(googleLinkedStudent.id)
      );
      const action = exists ? "updateSoftballPlayer" : "createSoftballPlayer";
      const payload = {
        ...profileForm,
        id: googleLinkedStudent.id,
        jerseyChoices: profileForm.jerseyChoices,
        requestStatus: profileForm.jerseyRequest || profileForm.positionRequest ? "pending" : "",
      };
      const { result } = await apiRequest({ action: action, data: payload });
      if (!result.ok) {
        throw new Error(result.error || "送出失敗");
      }
      await loadPlayers();
      setStatusMessage("已送出資料");
    } catch (err) {
      setStatusMessage(err.message || "送出失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleAttendanceStatus = async (practiceId, status) => {
    if (!googleLinkedStudent || !googleLinkedStudent.id) {
      setStatusMessage("請先登入 Google");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await apiRequest({
        action: "submitSoftballAttendance",
        data: {
          practiceId: practiceId,
          studentId: googleLinkedStudent.id,
          status: status,
          note: String(attendanceNoteMap[practiceId] || "").trim(),
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      await loadAttendance(googleLinkedStudent.id);
    } catch (err) {
      setStatusMessage(err.message || "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const attendanceByPractice = attendance.reduce((acc, item) => {
    const key = normalizeId_(item.practiceId);
    if (key) {
      acc[key] = item;
    }
    return acc;
  }, {});

  const fieldById = fields.reduce((acc, field) => {
    const key = normalizeId_(field.id);
    if (key) {
      acc[key] = field;
    }
    return acc;
  }, {});

  const isTimeOnly_ = (value) => {
    if (!value) {
      return false;
    }
    const raw = String(value).trim();
    return /^\d{1,2}:\d{2}$/.test(raw) || /^\d{1,2}:\d{2}:\d{2}$/.test(raw);
  };

  const isSentinelDate_ = (value) => {
    if (!value) {
      return false;
    }
    const raw = String(value).trim();
    const match = raw.match(/(\d{4})[-/]\d{1,2}[-/]\d{1,2}/);
    if (!match) {
      return false;
    }
    const year = Number(match[1]);
    return year > 0 && year <= 1900;
  };

  const getDatePartsFromValue_ = (value) => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return {
        year: value.getFullYear(),
        month: value.getMonth() + 1,
        day: value.getDate(),
      };
    }
    if (typeof value === "number") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime())
        ? null
        : {
            year: parsed.getFullYear(),
            month: parsed.getMonth() + 1,
            day: parsed.getDate(),
          };
    }
    const raw = String(value).trim();
    const dateOnlyMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      return year && month && day ? { year, month, day } : null;
    }
    if (isSentinelDate_(raw)) {
      return null;
    }
    if (/T/.test(raw) && (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw))) {
      const parsed = new Date(raw);
      return isNaN(parsed.getTime())
        ? null
        : {
            year: parsed.getFullYear(),
            month: parsed.getMonth() + 1,
            day: parsed.getDate(),
          };
    }
    const match = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!match) {
      return null;
    }
    if (isSentinelDate_(match[0])) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || !month || !day) {
      return null;
    }
    return { year, month, day };
  };

  const formatDateParts_ = (parts) => {
    if (!parts) {
      return "";
    }
    return `${parts.year}-${pad2_(parts.month)}-${pad2_(parts.day)}`;
  };

  const getTimePartsFromValue_ = (value) => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return { hour: value.getHours(), minute: value.getMinutes() };
    }
    if (typeof value === "number") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime())
        ? null
        : { hour: parsed.getHours(), minute: parsed.getMinutes() };
    }
    const raw = String(value).trim();
    const ampmMatch = raw.match(/(上午|下午)\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (ampmMatch) {
      let hour = Number(ampmMatch[2]);
      const minute = Number(ampmMatch[3]);
      if (ampmMatch[1] === "下午" && hour < 12) {
        hour += 12;
      }
      if (ampmMatch[1] === "上午" && hour === 12) {
        hour = 0;
      }
      return { hour, minute };
    }
    if (isSentinelDate_(raw)) {
      if (/T/.test(raw) && (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw))) {
        const parsed = new Date(raw);
        return isNaN(parsed.getTime())
          ? null
          : { hour: parsed.getHours(), minute: parsed.getMinutes() };
      }
      const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) {
        return null;
      }
      return { hour: Number(timeMatch[1]), minute: Number(timeMatch[2]) };
    }
    const match = raw.match(/(\d{1,2}):(\d{2})/);
    if (!match) {
      return null;
    }
    return { hour: Number(match[1]), minute: Number(match[2]) };
  };

  const parsePracticeDate_ = (value) => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    const raw = String(value).trim();
    if (!raw) {
      return null;
    }
    if (isTimeOnly_(raw)) {
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parts = raw.split("-").map((part) => Number(part));
      const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const buildPracticeDateTime_ = (practice) => {
    const baseParts = getDatePartsFromValue_(practice.date);
    const timeParts = getTimePartsFromValue_(practice.startAt);
    if (baseParts) {
      const baseDate = formatDateParts_(baseParts);
      if (timeParts && Number.isFinite(timeParts.hour) && Number.isFinite(timeParts.minute)) {
        return parsePracticeDate_(
          `${baseDate} ${pad2_(timeParts.hour)}:${pad2_(timeParts.minute)}`
        );
      }
      return parsePracticeDate_(baseDate);
    }
    const fallbackParts = getDatePartsFromValue_(practice.startAt);
    if (fallbackParts) {
      const fallbackDate = formatDateParts_(fallbackParts);
      if (timeParts && Number.isFinite(timeParts.hour) && Number.isFinite(timeParts.minute)) {
        return parsePracticeDate_(
          `${fallbackDate} ${pad2_(timeParts.hour)}:${pad2_(timeParts.minute)}`
        );
      }
      return parsePracticeDate_(fallbackDate);
    }
    return parsePracticeDate_(practice.date) || parsePracticeDate_(practice.startAt);
  };

  const getPracticeSortKey_ = (practice) => {
    const dateParts = getDatePartsFromValue_(practice.date) || getDatePartsFromValue_(practice.startAt);
    if (!dateParts) {
      return Number.POSITIVE_INFINITY;
    }
    const timeParts = getTimePartsFromValue_(practice.startAt) || { hour: 0, minute: 0 };
    const dateKey = dateParts.year * 10000 + dateParts.month * 100 + dateParts.day;
    const timeKey = pad2_(timeParts.hour) === "00" && pad2_(timeParts.minute) === "00"
      ? 0
      : timeParts.hour * 100 + timeParts.minute;
    return dateKey * 10000 + timeKey;
  };

  const getPracticeDateLabel_ = (practice) => {
    const parts = getDatePartsFromValue_(practice.date) || getDatePartsFromValue_(practice.startAt);
    if (parts) {
      const dateLocal = new Date(parts.year, parts.month - 1, parts.day);
      const weekday = ["日", "一", "二", "三", "四", "五", "六"][dateLocal.getDay()];
      return `${parts.year}/${pad2_(parts.month)}/${pad2_(parts.day)} (週${weekday})`;
    }
    return formatEventDate_(practice.date || practice.startAt);
  };

  const getPracticeTimeLabel_ = (value) => {
    if (!value) {
      return "";
    }
    const raw = String(value).trim();
    if (isTimeOnly_(raw)) {
      const parts = getTimePartsFromValue_(raw);
      if (!parts) {
        return "";
      }
      const clean = `${pad2_(parts.hour)}:${pad2_(parts.minute)}`;
      return clean === "00:00" ? "" : clean;
    }
    const parts = getTimePartsFromValue_(value);
    if (!parts) {
      return "";
    }
    const hours = pad2_(parts.hour);
    const minutes = pad2_(parts.minute);
    return hours === "00" && minutes === "00" ? "" : `${hours}:${minutes}`;
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayKey =
    todayStart.getFullYear() * 10000 + (todayStart.getMonth() + 1) * 100 + todayStart.getDate();
  const sortedPractices = practices.slice().sort((a, b) => getPracticeSortKey_(a) - getPracticeSortKey_(b));
  const upcomingPractices = sortedPractices.filter((practice) => {
    const parts = getDatePartsFromValue_(practice.date) || getDatePartsFromValue_(practice.startAt);
    if (!parts) {
      return true;
    }
    const key = parts.year * 10000 + parts.month * 100 + parts.day;
    return key >= todayKey;
  });
  const historyPractices = sortedPractices.filter((practice) => {
    const parts = getDatePartsFromValue_(practice.date) || getDatePartsFromValue_(practice.startAt);
    if (!parts) {
      return false;
    }
    const key = parts.year * 10000 + parts.month * 100 + parts.day;
    return key < todayKey;
  });
  const nextPractice = upcomingPractices.length ? upcomingPractices[0] : null;
  const remainingUpcomingPractices = upcomingPractices.length > 1 ? upcomingPractices.slice(1) : [];

  const jerseyTakenSet = new Set(
    players.map((player) => formatJerseyLabel_(String(player.jerseyNumber || ""))).filter(Boolean)
  );
  const jerseyReservedSet = new Set(
    players
      .map((player) => String(player.jerseyRequest || "").trim())
      .filter((value) => value)
      .map((value) => formatJerseyLabel_(value))
  );
  const myReserved =
    profileForm.jerseyRequest && formatJerseyLabel_(profileForm.jerseyRequest);
  const jerseyChoices = profileForm.jerseyChoices
    ? profileForm.jerseyChoices.split(",").map((value) => formatJerseyLabel_(value.trim())).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            NTU EMBA 115B
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            壘球隊 · 球員入口
          </h1>
          <p className="mt-3 text-sm text-slate-500">背號申請、位置偏好、練習出席回覆。</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
        <section className="mb-6 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-6">
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
            {[
              { id: "profile", label: "我的資料" },
              { id: "attendance", label: "練習回覆" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`rounded-xl px-4 py-2 ${
                  activeTab === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {statusMessage ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
            {statusMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {activeTab === "profile" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
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
                  helperText="登入後可申請背號與更新資料。"
                  onLinkedStudent={(student) => setGoogleLinkedStudent(student)}
                />
              </div>
            ) : null}
            <form onSubmit={handleSubmitProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">學號 / ID</label>
                <input
                  value={profileForm.id}
                  readOnly
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm text-slate-700"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">姓名</label>
                <input
                  value={profileForm.name}
                  onChange={(event) => handleProfileChange("name", event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">稱呼</label>
                <input
                  value={profileForm.preferredName}
                  onChange={(event) => handleProfileChange("preferredName", event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  value={profileForm.email}
                  onChange={(event) => handleProfileChange("email", event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">聯絡電話</label>
                <input
                  value={profileForm.phone}
                  onChange={(event) => handleProfileChange("phone", event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">背號申請</label>
                  <input
                    value={profileForm.jerseyRequest}
                    readOnly
                    placeholder="請從下方志願中選擇"
                    className="h-11 rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm text-slate-700"
                  />
                  <p className="text-xs text-slate-400">
                    可選 00-99，截止日為 {softballConfig.jerseyDeadline || "待公告"}
                  </p>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">球員暱稱</label>
                <input
                  value={profileForm.nickname}
                  onChange={(event) => handleProfileChange("nickname", event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">位置偏好</label>
                <div className="flex flex-wrap gap-2">
                  {POSITION_OPTIONS.map((item) => {
                    const current = String(profileForm.positionRequest || "");
                    const active = current.split(",").map((value) => value.trim()).includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          const selected = current
                            ? current.split(",").map((value) => value.trim()).filter(Boolean)
                            : [];
                          const next = active
                            ? selected.filter((value) => value !== item)
                            : selected.concat(item);
                          handleProfileChange("positionRequest", next.join(", "));
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">背號志願（最多 3 個）</label>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {jerseyNumbers.map((number) => {
                    const isTaken = jerseyTakenSet.has(number);
                    const isReserved = jerseyReservedSet.has(number);
                    const isMine = myReserved === number;
                    const isSelected = jerseyChoices.includes(number);
                    const disabled = isTaken || (isReserved && !isMine);
                    return (
                      <button
                        key={`jersey-${number}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) {
                            return;
                          }
                          let next = jerseyChoices.slice();
                          if (isSelected) {
                            next = next.filter((value) => value !== number);
                          } else if (next.length < 3) {
                            next = next.concat(number);
                          }
                          handleProfileChange("jerseyChoices", next.join(","));
                          handleProfileChange("jerseyRequest", next[0] || "");
                        }}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                          isTaken
                            ? "border-slate-200 bg-slate-100 text-slate-400"
                            : isReserved && !isMine
                            ? "border-amber-200 bg-amber-50 text-amber-600"
                            : isSelected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {number}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
                  <span>已選：{jerseyChoices.join(", ") || "-"}</span>
                  <span>已占用：灰色</span>
                  <span>暫保留：橘色</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">打擊</label>
                  <select
                    value={profileForm.bats}
                    onChange={(event) => handleProfileChange("bats", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  >
                    <option value="">未設定</option>
                    <option value="R">右打</option>
                    <option value="L">左打</option>
                    <option value="S">左右開弓</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">投球/傳球</label>
                  <select
                    value={profileForm.throws}
                    onChange={(event) => handleProfileChange("throws", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                  >
                    <option value="">未設定</option>
                    <option value="R">右投</option>
                    <option value="L">左投</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">備註</label>
                <textarea
                  value={profileForm.notes}
                  onChange={(event) => handleProfileChange("notes", event.target.value)}
                  rows="3"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "送出中..." : "送出申請"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {activeTab === "attendance" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">練習出席回覆</h3>
                <p className="mt-1 text-xs text-slate-500">回覆會自動儲存。</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400">
                  最後更新：{practicesUpdatedAt ? formatDisplayDate_(practicesUpdatedAt, { withTime: true }) : "-"}
                </span>
                <button
                  type="button"
                  onClick={handleRefreshPractices}
                  disabled={practiceRefreshing}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-60"
                >
                  {practiceRefreshing ? "更新中..." : "重新整理"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 space-y-3">
                <div className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-5">
                  <div className="h-3 w-24 rounded-full bg-slate-200/80" />
                  <div className="mt-4 h-5 w-48 rounded-full bg-slate-200/80" />
                  <div className="mt-2 h-4 w-32 rounded-full bg-slate-100" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={`practice-skeleton-${item}`} className="h-8 w-16 rounded-full bg-slate-100" />
                    ))}
                    <div className="h-8 w-32 rounded-full bg-slate-100" />
                  </div>
                </div>
                <p className="text-xs text-slate-400">載入練習中…</p>
              </div>
            ) : nextPractice ? (
              <div className="mt-6 rounded-3xl border border-emerald-200/80 bg-emerald-50/70 p-5 text-sm text-emerald-900">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/70">
                  下一場練習
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-emerald-900">
                      {getPracticeDateLabel_(nextPractice)} · {nextPractice.title || "練習"}
                    </p>
                    {getPracticeTimeLabel_(nextPractice.startAt) ||
                    getPracticeTimeLabel_(nextPractice.endAt) ? (
                      <p className="mt-1 text-sm text-emerald-800/80">
                        {getPracticeTimeLabel_(nextPractice.startAt) || "-"} -{" "}
                        {getPracticeTimeLabel_(nextPractice.endAt) || "-"}
                      </p>
                    ) : null}
                    {nextPractice.fieldId && fieldById[normalizeId_(nextPractice.fieldId)] ? (
                      <p className="mt-2 text-sm text-emerald-800/80">
                        場地：{fieldById[normalizeId_(nextPractice.fieldId)].name || "未命名"}
                        {fieldById[normalizeId_(nextPractice.fieldId)].mapUrl ||
                        fieldById[normalizeId_(nextPractice.fieldId)].address ? (
                          <>
                            {" · "}
                            <a
                              href={
                                fieldById[normalizeId_(nextPractice.fieldId)].mapUrl ||
                                buildGoogleMapsUrl_(fieldById[normalizeId_(nextPractice.fieldId)].address)
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-emerald-900 hover:text-emerald-700"
                            >
                              地圖
                            </a>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { value: "attend", label: "出席" },
                      { value: "late", label: "遲到" },
                      { value: "absent", label: "缺席" },
                      { value: "unknown", label: "未定" },
                    ].map((item) => {
                      const record = attendanceByPractice[normalizeId_(nextPractice.id)] || {};
                      const currentStatus = String(record.status || "unknown").toLowerCase();
                      return (
                        <button
                          key={`${nextPractice.id}-${item.value}`}
                          onClick={() => handleAttendanceStatus(nextPractice.id, item.value)}
                          className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                            currentStatus === item.value
                              ? "border-emerald-900 bg-emerald-900 text-white"
                              : "border-emerald-200 bg-white text-emerald-800 hover:border-emerald-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                    <input
                      value={
                        attendanceNoteMap[nextPractice.id] ||
                        (attendanceByPractice[normalizeId_(nextPractice.id)] || {}).note ||
                        ""
                      }
                      onChange={(event) =>
                        setAttendanceNoteMap((prev) => ({ ...prev, [nextPractice.id]: event.target.value }))
                      }
                      placeholder="備註"
                      className="h-9 w-40 rounded-full border border-emerald-200 bg-white px-3 text-xs text-emerald-900"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {remainingUpcomingPractices.length ? (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-900">接下來的練習</h4>
                <div className="mt-4 space-y-3">
                  {remainingUpcomingPractices.map((practice) => {
                    const record = attendanceByPractice[normalizeId_(practice.id)] || {};
                    const currentStatus = String(record.status || "unknown").toLowerCase();
                    return (
                      <div
                        key={practice.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {getPracticeDateLabel_(practice)} · {practice.title || "練習"}
                          </p>
                          {getPracticeTimeLabel_(practice.startAt) ||
                          getPracticeTimeLabel_(practice.endAt) ? (
                            <p className="text-xs text-slate-500">
                              {getPracticeTimeLabel_(practice.startAt) || "-"} -{" "}
                              {getPracticeTimeLabel_(practice.endAt) || "-"}
                            </p>
                          ) : null}
                          {practice.fieldId && fieldById[normalizeId_(practice.fieldId)] ? (
                            <p className="mt-1 text-xs text-slate-500">
                              場地：{fieldById[normalizeId_(practice.fieldId)].name || "未命名"}
                              {fieldById[normalizeId_(practice.fieldId)].mapUrl ||
                              fieldById[normalizeId_(practice.fieldId)].address ? (
                                <>
                                  {" · "}
                                  <a
                                    href={
                                      fieldById[normalizeId_(practice.fieldId)].mapUrl ||
                                      buildGoogleMapsUrl_(fieldById[normalizeId_(practice.fieldId)].address)
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-slate-600 hover:text-slate-800"
                                  >
                                    地圖
                                  </a>
                                </>
                              ) : null}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {[
                            { value: "attend", label: "出席" },
                            { value: "late", label: "遲到" },
                            { value: "absent", label: "缺席" },
                            { value: "unknown", label: "未定" },
                          ].map((item) => (
                            <button
                              key={`${practice.id}-${item.value}`}
                              onClick={() => handleAttendanceStatus(practice.id, item.value)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                currentStatus === item.value
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                          <input
                            value={attendanceNoteMap[practice.id] || record.note || ""}
                            onChange={(event) =>
                              setAttendanceNoteMap((prev) => ({ ...prev, [practice.id]: event.target.value }))
                            }
                            placeholder="備註"
                            className="h-8 w-36 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : !nextPractice && !loading ? (
              <p className="mt-4 text-sm text-slate-500">目前沒有練習。</p>
            ) : null}

            {historyPractices.length ? (
              <div className="mt-8">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-900">歷史練球</h4>
                  <button
                    type="button"
                    onClick={() => setHistoryExpanded((prev) => !prev)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                  >
                    {historyExpanded ? "收合" : "展開"}
                  </button>
                </div>
                {historyExpanded ? (
                  <div className="mt-4 space-y-3">
                    {historyPractices.map((practice) => {
                      const record = attendanceByPractice[normalizeId_(practice.id)] || {};
                      const currentStatus = String(record.status || "unknown").toLowerCase();
                      return (
                        <div
                          key={practice.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-500"
                        >
                          <div>
                            <p className="font-semibold text-slate-700">
                              {getPracticeDateLabel_(practice)} · {practice.title || "練習"}
                            </p>
                            {getPracticeTimeLabel_(practice.startAt) ||
                            getPracticeTimeLabel_(practice.endAt) ? (
                              <p className="text-xs text-slate-400">
                                {getPracticeTimeLabel_(practice.startAt) || "-"} -{" "}
                                {getPracticeTimeLabel_(practice.endAt) || "-"}
                              </p>
                            ) : null}
                            {practice.fieldId && fieldById[normalizeId_(practice.fieldId)] ? (
                              <p className="mt-1 text-xs text-slate-400">
                                場地：{fieldById[normalizeId_(practice.fieldId)].name || "未命名"}
                                {fieldById[normalizeId_(practice.fieldId)].mapUrl ||
                                fieldById[normalizeId_(practice.fieldId)].address ? (
                                  <>
                                    {" · "}
                                    <a
                                      href={
                                        fieldById[normalizeId_(practice.fieldId)].mapUrl ||
                                        buildGoogleMapsUrl_(fieldById[normalizeId_(practice.fieldId)].address)
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-semibold text-slate-500 hover:text-slate-700"
                                    >
                                      地圖
                                    </a>
                                  </>
                                ) : null}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 opacity-80">
                            {[
                              { value: "attend", label: "出席" },
                              { value: "late", label: "遲到" },
                              { value: "absent", label: "缺席" },
                              { value: "unknown", label: "未定" },
                            ].map((item) => (
                              <button
                                key={`${practice.id}-${item.value}`}
                                onClick={() => handleAttendanceStatus(practice.id, item.value)}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                  currentStatus === item.value
                                    ? "border-slate-700 bg-slate-700 text-white"
                                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                            <input
                              value={attendanceNoteMap[practice.id] || record.note || ""}
                              onChange={(event) =>
                                setAttendanceNoteMap((prev) => ({
                                  ...prev,
                                  [practice.id]: event.target.value,
                                }))
                              }
                              placeholder="備註"
                              className="h-8 w-36 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    已收合 {historyPractices.length} 場歷史練球。
                  </p>
                )}
              </div>
            ) : null}
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

function CheckinPage() {
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
              className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white sm:inline-flex"
            >
              回到首頁
            </a>
            <span className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm sm:inline-flex">
              立即簽到
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-28 pt-10 sm:px-12">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
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
            <p className="mt-2 text-xs font-semibold text-rose-600">
              無法簽到，請洽活動負責人。
            </p>
          ) : null}

          <div className="mt-6 grid gap-4">
            {googleLinkedStudent && googleLinkedStudent.email ? (
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
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
                disabled={Boolean(googleLinkedStudent && googleLinkedStudent.email)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>
            {errorDisplay ? (
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
                <p className="font-semibold">{errorDisplay.title}</p>
                <p className="mt-1 text-rose-600">{errorDisplay.message}</p>
                {errorDisplay.action ? (
                  <p className="mt-2 text-xs text-rose-500">{errorDisplay.action}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || isCheckinBlocked}
            className="mt-8 hidden w-full items-center justify-center gap-2 rounded-2xl bg-[#1e293b] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
          >
            {loading ? "簽到中..." : "確認簽到"}
          </button>
        </section>
      </main>

      <div className="fixed bottom-5 left-4 right-4 z-20 sm:hidden">
        <button
          onClick={handleSubmit}
          disabled={loading || isCheckinBlocked}
          className="flex w-full items-center justify-center rounded-2xl bg-[#1e293b] px-6 py-4 text-base font-semibold text-white shadow-2xl shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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

function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
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
        badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
        statusKey: "not_registered",
      };
    }
    if (checkinStatus && checkinStatus.status === "not_attending") {
      return {
        label: "已報名不克出席",
        badgeClass: "border-rose-200 bg-rose-50 text-rose-600",
        statusKey: "not_attending",
      };
    }
    if (checkinStatus && checkinStatus.status === "attendance_unknown") {
      return {
        label: "已報名還不確定",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
        statusKey: "attendance_unknown",
      };
    }
    if (
      checkinStatus &&
      (checkinStatus.status === "checked_in" || checkinStatus.status === "not_checked_in")
    ) {
      return {
        label: "已報名會出席",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
        statusKey: "attending",
      };
    }
    const fields = parseCustomFields_(registration && registration.customFields);
    const attendance = String(fields.attendance || "").trim();
    if (attendance === "出席") {
      return {
        label: "已報名會出席",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
        statusKey: "attending",
      };
    }
    if (attendance === "不克出席") {
      return {
        label: "已報名不克出席",
        badgeClass: "border-rose-200 bg-rose-50 text-rose-600",
        statusKey: "not_attending",
      };
    }
    return {
      label: "已報名還不確定",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
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
        console.debug("[HomePage] listEvents request", API_URL);
        const { result, url } = await apiRequest({ action: "listEvents" });
        console.debug("[HomePage] listEvents url", url);
        console.debug("[HomePage] listEvents payload", result);
        if (!result.ok) {
          throw new Error(result.error || "載入失敗");
        }
        if (!ignore) {
          setEvents(result.data && result.data.events ? result.data.events : []);
        }
      } catch (err) {
        if (!ignore) {
          setError("活動列表暫時無法載入。");
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
              活動首頁
            </h1>
          </div>
          <span className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm sm:inline-flex">
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
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
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
                  disabled={Boolean(googleLinkedStudent && googleLinkedStudent.email)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>
              <button
                onClick={() => handleLookup(lookupEmail)}
                disabled={lookupLoading}
                className="inline-flex items-center justify-center rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-5 text-sm text-slate-600">
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
                      <span
                        className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.badgeClass}`}
                      >
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
                          className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-slate-300"
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
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
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
            <div className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
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
                        badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
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
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100"
                      : registrationStatus.statusKey === "not_attending"
                        ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                        : registrationStatus.statusKey === "attendance_unknown"
                          ? "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100"
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
                          <span
                            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${badgeClass}`}
                          >
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

function AdminPage({
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
        personEmail: payload.personEmail || "",
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
      personEmail: student.googleEmail || student.email || "",
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
      personEmail: membership.personEmail || "",
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
      personEmail: payload.personEmail,
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
      personEmail: student.googleEmail || student.email || "",
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
      personEmail: selectedMember.personEmail,
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
            personEmail: item.personEmail,
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
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 pb-28 pt-10 sm:px-12">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-6">
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

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
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
            <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
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
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">標題</label>
                    <input
                      value={orderForm.title}
                      onChange={(event) => handleOrderFormChange("title", event.target.value)}
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">選項 A</label>
                      <input
                        value={orderForm.optionA}
                        onChange={(event) => handleOrderFormChange("optionA", event.target.value)}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">選項 B</label>
                      <input
                        value={orderForm.optionB}
                        onChange={(event) => handleOrderFormChange("optionB", event.target.value)}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">狀態</label>
                      <select
                        value={orderForm.status}
                        onChange={(event) => handleOrderFormChange("status", event.target.value)}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                      className="inline-flex items-center justify-center rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-5 text-sm text-slate-600">
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
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                      已報名 {registeredCount}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                      未報名 {unregisteredCount}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                      出席 {attendanceCounts.attending}
                    </span>
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
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
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : attendanceStatus === "unknown"
                          ? "border-slate-300 bg-slate-100 text-slate-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-400";
                      return (
                        <span
                          key={student.id || student.googleEmail || student.email}
                          title={hoverTitle}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${badgeStyle}`}
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
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                      已簽到 {checkinList.length}
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
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
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-800"
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
                          ? "border-rose-200 bg-rose-50 text-rose-700"
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
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          已選：{selectedMember.personName || selectedMember.personId}
                        </span>
                      ) : null}
                      {selectedMember ? (
                        <button
                          type="button"
                          onClick={() => handleSelectMember_(null)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                        >
                          取消選取
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleResetMembershipDrafts_}
                        disabled={!membershipDirty || saving}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-600 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
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
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        全部展開
                      </button>
                      <button
                        type="button"
                        onClick={collapseAllGroups_}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
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
                                ? "border-amber-200 bg-amber-50 text-amber-700"
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
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
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
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">結束時間</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(event) => handleChange("endAt", event.target.value)}
                placeholder="2024-10-18 21:30"
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">地點</label>
              <input
                value={form.location}
                onChange={(event) => handleChange("location", event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">地址</label>
              <input
                value={form.address}
                onChange={(event) => handleChange("address", event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">可攜伴</label>
              <select
                value={form.allowCompanions}
                onChange={(event) => handleChange("allowCompanions", event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">報名截止</label>
              <input
                type="datetime-local"
                value={form.registrationCloseAt}
                onChange={(event) => handleChange("registrationCloseAt", event.target.value)}
                placeholder="2024-10-10 23:00"
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">簽到開始</label>
              <input
                type="datetime-local"
                value={form.checkinOpenAt}
                onChange={(event) => handleChange("checkinOpenAt", event.target.value)}
                placeholder="2024-10-18 18:00"
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">簽到截止</label>
              <input
                type="datetime-local"
                value={form.checkinCloseAt}
                onChange={(event) => handleChange("checkinCloseAt", event.target.value)}
                placeholder="2024-10-18 20:30"
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">報名連結</label>
                <input
                  value={form.registerUrl}
                  onChange={(event) => handleChange("registerUrl", event.target.value)}
                  placeholder="https://your-domain/register?eventId=24011801"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-slate-300"
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
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-slate-300"
                  >
                    使用正式網域產生
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleCopyRegisterUrl}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-slate-300"
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
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-slate-300"
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
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-slate-300"
                  >
                    使用正式網域產生
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleCopyCheckinUrl}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-slate-300"
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
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">同學列表</h2>
            <p className="mt-2 text-sm text-slate-500">
              此處顯示 Students 名單，提供未報名統計與快速查詢。
            </p>
          </section>
        ) : null}

        {activeTab === "registrations" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">更新報名狀態</h2>
            <form onSubmit={handleRegistrationSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">報名 ID</label>
                <input
                  value={registrationForm.id}
                  onChange={(event) => setRegistrationForm((prev) => ({ ...prev, id: event.target.value }))}
                  placeholder="輸入報名 ID / 學號 (P...) / 姓名"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">狀態</label>
                <select
                  value={registrationForm.status}
                  onChange={(event) => setRegistrationForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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

function DirectoryPage() {
  const [auth, setAuth] = useState(() => localStorage.getItem("directoryToken") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");

  const matchesDirectoryQuery_ = (item, query) => {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) {
      return true;
    }
    const haystack = [
      item.id,
      item.email,
      item.nameZh,
      item.nameEn,
      item.preferredName,
      item.group,
      item.company,
      item.title,
      item.mobile,
      item.backupPhone,
      item.emergencyContact,
      item.emergencyPhone,
      item.dietaryRestrictions,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(needle);
  };

  const filteredDirectory = directory.filter((item) =>
    matchesDirectoryQuery_(item, directoryQuery)
  );

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      const { result } = await apiRequest({
        action: "login",
        email: String(email || "").trim().toLowerCase(),
        password: password,
      });
      if (!result.ok) {
        throw new Error(result.error || "登入失敗");
      }
      const token = result.data && result.data.token ? result.data.token : "";
      if (!token) {
        throw new Error("登入失敗");
      }
      localStorage.setItem("directoryToken", token);
      setAuth(token);
      setPassword("");
      await loadDirectory(token);
    } catch (err) {
      setLoginError(err.message || "登入失敗");
    } finally {
      setLoading(false);
    }
  };

  const loadDirectory = async (token) => {
    setLoading(true);
    setImportResult("");
    try {
      const { result } = await apiRequest({ action: "listDirectory", authToken: token || auth });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setDirectory(result.data && result.data.directory ? result.data.directory : []);
    } catch (err) {
      setLoginError("載入失敗，請重新登入。");
      setAuth("");
      localStorage.removeItem("directoryToken");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth) {
      loadDirectory(auth);
    }
  }, [auth]);

  const handleImport = async () => {
    setImportResult("");
    const parsed = parseDirectoryImport_(importText);
    if (!parsed.length) {
      setImportResult("沒有可匯入的資料。");
      return;
    }
    setLoading(true);
    try {
      const { result } = await apiRequest({
        action: "upsertDirectory",
        authToken: auth,
        items: parsed,
      });
      if (!result.ok) {
        throw new Error(result.error || "匯入失敗");
      }
      setImportResult(`已更新 ${result.data.updated} 筆，新增 ${result.data.created} 筆。`);
      setImportText("");
      await loadDirectory(auth);
    } catch (err) {
      setImportResult(err.message || "匯入失敗");
    } finally {
      setLoading(false);
    }
  };

  if (!auth) {
    return (
      <div className="min-h-screen">
        <header className="px-6 pt-8 sm:px-12">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                NTU EMBA 115B
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                同學資料庫
              </h1>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-6 pb-28 pt-10 sm:px-12">
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">管理者登入</h2>
            <form onSubmit={handleLogin} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">密碼</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              {loginError ? (
                <div className="sm:col-span-2 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
                  {loginError}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="sm:col-span-2 rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "登入中..." : "登入"}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              同學資料庫
            </h1>
          </div>
          <button
            onClick={() => {
              setAuth("");
              localStorage.removeItem("directoryToken");
            }}
            className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm sm:inline-flex"
          >
            登出
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-28 pt-10 sm:px-12">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">匯入同學資料</h2>
            {loading ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                處理中
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            支援欄位：學號、組別、Email、中文姓名、英文姓名、稱呼、公司、職稱、社群網址、行動電話、備用電話、緊急聯絡人、緊急聯絡人電話。
          </p>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows="8"
            className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
            placeholder="貼上 CSV 或 Excel 複製的表格內容 (含標題列)"
          />
          {importResult ? (
            <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
              {importResult}
            </div>
          ) : null}
          <button
            onClick={handleImport}
            disabled={loading}
            className="mt-4 rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            匯入資料
          </button>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">同學列表</h2>
            <span className="text-xs text-slate-400">共 {filteredDirectory.length} 筆</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <input
              value={directoryQuery}
              onChange={(event) => setDirectoryQuery(event.target.value)}
              placeholder="搜尋姓名、Email、公司、分組..."
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="mt-6 space-y-4">
            {filteredDirectory.map((item) => (
              <div
                key={item.id || item.email}
                className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.nameZh || "未命名"}</p>
                    <p className="text-xs text-slate-500">
                      {item.id || "-"} · {item.email}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.group ? `${item.group} · ` : ""}{item.mobile}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <div>英文姓名: {item.nameEn || "-"}</div>
                  <div>稱呼: {item.preferredName || "-"}</div>
                  <div>公司: {item.company || "-"}</div>
                  <div>職稱: {item.title || "-"}</div>
                  <div>社群: {item.socialUrl || "-"}</div>
                  <div>備用電話: {item.backupPhone || "-"}</div>
                  <div>緊急聯絡人: {item.emergencyContact || "-"}</div>
                  <div>緊急聯絡人電話: {item.emergencyPhone || "-"}</div>
                  <div>飲食禁忌: {item.dietaryRestrictions || "-"}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function parseDirectoryImport_(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line);
  if (!lines.length) {
    return [];
  }
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((header) => header.trim());
  const map = {
    ID: "id",
    Id: "id",
    id: "id",
    學號: "id",
    同學ID: "id",
    組別: "group",
    Group: "group",
    "Email 信箱": "email",
    Email: "email",
    email: "email",
    "中文姓名": "nameZh",
    "英文姓名": "nameEn",
    "希望大家怎麼叫妳/你（非必填）": "preferredName",
    "希望大家怎麼叫你": "preferredName",
    稱呼: "preferredName",
    公司: "company",
    公司名稱: "company",
    職稱: "title",
    職位: "title",
    "FB/IG  社群網站網址 (非必填)": "socialUrl",
    "FB/IG 社群網站網址 (非必填)": "socialUrl",
    "FB/IG 社群網站網址": "socialUrl",
    "行動電話": "mobile",
    "備用的連絡電話（公司或住家 ）": "backupPhone",
    "備用的連絡電話（公司或住家）": "backupPhone",
    "緊急聯絡人姓名（與您的關係)": "emergencyContact",
    "緊急聯絡人姓名": "emergencyContact",
    "緊急聯絡人/關係": "emergencyContact",
    "緊急聯絡人": "emergencyContact",
    "緊急聯絡人電話": "emergencyPhone",
    飲食禁忌: "dietaryRestrictions",
    飲食限制: "dietaryRestrictions",
  };
  const mapped = headers.map((header) => map[header] || "");
  return lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((col) => col.trim());
    const record = {};
    mapped.forEach((key, index) => {
      if (!key) {
        return;
      }
      record[key] = cols[index] || "";
    });
    if (!record.email) {
      return null;
    }
    return record;
  }).filter(Boolean);
}

function addDays_(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function pad2_(value) {
  return String(value).padStart(2, "0");
}

function toLocalInput_(date, hours, minutes) {
  const safe = new Date(date);
  safe.setHours(hours, minutes, 0, 0);
  return `${safe.getFullYear()}-${pad2_(safe.getMonth() + 1)}-${pad2_(safe.getDate())}T${pad2_(
    safe.getHours()
  )}:${pad2_(safe.getMinutes())}`;
}

function toLocalInputValue_(date) {
  return `${date.getFullYear()}-${pad2_(date.getMonth() + 1)}-${pad2_(date.getDate())}T${pad2_(
    date.getHours()
  )}:${pad2_(date.getMinutes())}`;
}

function parseLocalInputDate_(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function addMinutes_(date, minutes) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function generateEventId_(date, category, events, seed) {
  const yymmdd = `${String(date.getFullYear()).slice(-2)}${pad2_(date.getMonth() + 1)}${pad2_(
    date.getDate()
  )}`;
  const suffixes = (events || [])
    .map((event) => String(event.id || ""))
    .filter((id) => id.startsWith(yymmdd))
    .map((id) => id.slice(yymmdd.length))
    .map((value) => parseInt(value, 10))
    .filter((value) => !isNaN(value));
  const seedValue = seed ? new Date(seed) : new Date();
  const seedDay = `${String(seedValue.getFullYear()).slice(-2)}${pad2_(
    seedValue.getMonth() + 1
  )}${pad2_(seedValue.getDate())}`;
  const baseIndex = parseInt(seedDay.slice(-2), 10) % 99;
  const next = suffixes.length ? Math.max.apply(null, suffixes) + 1 : baseIndex + 1;
  return `${yymmdd}${String(next).padStart(2, "0")}`;
}
