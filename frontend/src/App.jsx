import React, { useEffect, useRef, useState } from "react";
import { getCheckinErrorDisplay, mapRegistrationError } from "./utils/errorMappings";

const gatheringFieldConfig = {
  attendance: {
    id: "attendance",
    label: "是否出席",
    options: ["出席", "不出席", "尚未確定"],
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
    options: ["出席", "不出席", "尚未確定"],
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
const EVENT_ID = "EVT-2024-10-18";
const DEFAULT_EVENT = {
  title: "秋季聚餐",
  location: "大直 · 磺溪會館",
  address: "台北市中山區樂群二路199號",
  startAt: "2024/10/18 18:30",
  endAt: "2024/10/18 21:30",
  category: "gathering",
  capacity: 60,
  status: "open",
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

const formatEventDateTime_ = (value) => {
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
  return `${parsed.getFullYear()}-${pad2_(parsed.getMonth() + 1)}-${pad2_(
    parsed.getDate()
  )} ${pad2_(parsed.getHours())}:${pad2_(parsed.getMinutes())}`;
};

const formatEventDate_ = (value) => {
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
  return `${parsed.getFullYear()}-${pad2_(parsed.getMonth() + 1)}-${pad2_(parsed.getDate())}`;
};

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

const normalizeCustomFieldsForSubmit_ = (fields) => {
  const source = fields || {};
  const bringDrinksValue = source.bringDrinks || (hasDrinkSelection_(source) ? "攜帶" : "");
  const normalized = { ...source, bringDrinks: bringDrinksValue };
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

  useEffect(() => {
    onLinkedRef.current = onLinkedStudent;
  }, [onLinkedStudent]);

  useEffect(() => {
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
  }, []);

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

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_-50px_rgba(15,23,42,0.7)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{resolvedTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">{resolvedHelper}</p>
        </div>
        <div ref={buttonRef} />
      </div>

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

export default function App() {
  const pathname = window.location.pathname;
  const isCheckinPage = pathname.includes("checkin");
  const isAdminPage = pathname.includes("admin");
  const isRegisterPage = pathname.includes("register");

  if (isCheckinPage) {
    return <CheckinPage />;
  }

  if (isAdminPage) {
    return <AdminPage />;
  }

  if (pathname.includes("directory")) {
    return <DirectoryPage />;
  }

  if (isRegisterPage) {
    return <RegistrationPage />;
  }

  return <HomePage />;
}

function RegistrationPage() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId") || EVENT_ID;
  const slug = params.get("slug") || "";
  const categoryParam = params.get("category");
  const titleParam = params.get("title");
  const locationParam = params.get("location");

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
  const [eventInfo, setEventInfo] = useState(DEFAULT_EVENT);
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
    const fetchEvent = async () => {
      try {
        const { result } = await apiRequest({ action: "getEvent", eventId: eventId });
        if (!result.ok) {
          throw new Error(result.error || "Event not found");
        }
        if (!ignore && result.data && result.data.event) {
          const event = result.data.event;
          setEventInfo({
            title: titleParam || event.title || DEFAULT_EVENT.title,
            location: locationParam || event.location || DEFAULT_EVENT.location,
            address: event.address || DEFAULT_EVENT.address,
            startAt: event.startAt || DEFAULT_EVENT.startAt,
            endAt: event.endAt || DEFAULT_EVENT.endAt,
            category: event.category || categoryParam || DEFAULT_EVENT.category,
            capacity: event.capacity || DEFAULT_EVENT.capacity,
            status: event.status || DEFAULT_EVENT.status,
          });
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
            prev.dietary
              ? prev
              : {
                  ...prev,
                  dietary: match.dietaryPreference || prev.dietary || "無禁忌",
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
      const payloadCustomFields = normalizeCustomFieldsForSubmit_(customFields);
      const { result } = await apiRequest({
        action: "register",
        data: {
          eventId: eventId,
          slug: slug,
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
      const payloadCustomFields = {
        ...normalizeCustomFieldsForSubmit_(customFields),
        notes: String(notes || "").trim(),
      };
      const { result } = await apiRequest({
        action: "updateRegistration",
        data: {
          id: existingRegistration.id,
          eventId: eventId,
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
    <div className="min-h-screen">
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
              {eventInfo.category === "meeting" ? "開會自訂欄位" : "聚餐自訂欄位"}
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
                  {eventInfo.category === "meeting" ? "開會" : "聚餐"}
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
              <li>報名截止：2024/10/10 23:00</li>
              <li>攜伴請於備註註明姓名</li>
              <li>若改為不出席請於截止日前更新</li>
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
      return value.toLocaleString();
    }
    if (typeof value === "number") {
      const parsedNumber = new Date(value);
      return isNaN(parsedNumber.getTime()) ? "" : parsedNumber.toLocaleString();
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
    return isNaN(parsed.getTime()) ? raw : parsed.toLocaleString();
  };

  const getRegistrationStatusInfo_ = (registration, checkinStatus) => {
    if (checkinStatus && checkinStatus.status === "not_registered") {
      return {
        label: "尚未報名",
        badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
      };
    }
    if (checkinStatus && checkinStatus.status === "not_attending") {
      return {
        label: "已報名不出席",
        badgeClass: "border-rose-200 bg-rose-50 text-rose-600",
      };
    }
    if (checkinStatus && checkinStatus.status === "attendance_unknown") {
      return {
        label: "已報名還不確定",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }
    if (
      checkinStatus &&
      (checkinStatus.status === "checked_in" || checkinStatus.status === "not_checked_in")
    ) {
      return {
        label: "已報名會出席",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }
    const fields = parseCustomFields_(registration && registration.customFields);
    const attendance = String(fields.attendance || "").trim();
    if (attendance === "出席") {
      return {
        label: "已報名會出席",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }
    if (attendance === "不出席") {
      return {
        label: "已報名不出席",
        badgeClass: "border-rose-200 bg-rose-50 text-rose-600",
      };
    }
    return {
      label: "已報名還不確定",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
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

      <main className="mx-auto max-w-6xl px-6 pb-28 pt-10 sm:px-12">
        <section className="mb-8 rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">我的報名</h2>
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
              {lookupError ? (
                <p className="text-xs font-semibold text-amber-600">{lookupError}</p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-5 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">簽到提醒</p>
              <p className="mt-2 text-xs text-slate-500">
                若活動開放簽到，系統會顯示對應的簽到連結。
              </p>
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
                        已回覆不出席，無法簽到，請洽活動負責人
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

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
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

          {!loading && !events.length && !error ? (
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
              : events.map((event) => {
                  const statusLabel = event.status === "open" ? "報名進行中" : "報名狀態更新";
                  const schedule = formatEventSchedule_(event.startAt, event.endAt);
                  const eventId = normalizeEventId_(event.id);
                  const registration = registrationsByEventId[eventId];
                  const checkinStatus = checkinStatuses[eventId] || null;
                  const registrationStatus = registration
                    ? getRegistrationStatusInfo_(registration, checkinStatus)
                    : {
                        label: "尚未報名",
                        badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
                      };
                  return (
                    <div
                      key={event.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{event.category === "meeting" ? "開會" : "聚餐"}</span>
                          <span>{statusLabel}</span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-900">{event.title}</h3>
                        {shouldShowRegistrationBadge ? (
                          <span
                            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${registrationStatus.badgeClass}`}
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
                        </div>
                      </div>
                      <a
                        href={`/register?eventId=${event.id}`}
                        className="mt-5 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                      >
                        前往報名
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

function AdminPage() {
  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [shortLinks, setShortLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");
  const [activeTab, setActiveTab] = useState("events");
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
  });
  const [studentForm, setStudentForm] = useState({
    id: "",
    name: "",
    googleSub: "",
    googleEmail: "",
  });
  const [shortLinkForm, setShortLinkForm] = useState({
    id: "",
    eventId: "",
    type: "register",
    slug: "",
    targetUrl: "",
    createdAt: "",
  });
  const [registrationForm, setRegistrationForm] = useState({
    id: "",
    status: "registered",
  });
  const [copyStatus, setCopyStatus] = useState("");
  const [registerCopyStatus, setRegisterCopyStatus] = useState("");

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

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (activeTab === "students") {
      loadStudents();
    }
    if (activeTab === "registrations") {
      loadRegistrations();
    }
    if (activeTab === "checkins") {
      loadCheckins();
    }
    if (activeTab === "shortlinks") {
      loadShortLinks();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!activeId) {
      setForm(buildDefaultForm(events));
    }
  }, [activeId, events, seedTimestamp]);

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

  const loadShortLinks = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listShortLinks" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setShortLinks(result.data && result.data.shortLinks ? result.data.shortLinks : []);
    } catch (err) {
      setError("短鏈結載入失敗。");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!String(studentForm.id || "").trim()) {
        throw new Error("請先填寫學號。");
      }
      const exists = students.some(
        (item) => String(item.id || "").trim() === String(studentForm.id || "").trim()
      );
      const action = exists ? "updateStudent" : "createStudent";
      const { result } = await apiRequest({ action: action, data: studentForm });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      setStudentForm({
        id: "",
        name: "",
        googleSub: "",
        googleEmail: "",
      });
      await loadStudents();
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleStudentEdit = (student) => {
    setStudentForm({
      id: student.id || "",
      name: student.name || "",
      googleSub: student.googleSub || "",
      googleEmail: student.googleEmail || "",
    });
  };

  const handleStudentDelete = async (id) => {
    if (!id) {
      return;
    }
    setSaving(true);
    try {
      const { result } = await apiRequest({ action: "deleteStudent", id: id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadStudents();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleShortLinkSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const action = shortLinkForm.slug ? "updateShortLink" : "createShortLink";
      const { result } = await apiRequest({ action: action, data: shortLinkForm });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      setShortLinkForm({
        id: "",
        eventId: "",
        type: "register",
        slug: "",
        targetUrl: "",
        createdAt: "",
      });
      await loadShortLinks();
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleShortLinkEdit = (link) => {
    setShortLinkForm({
      id: link.id || "",
      eventId: link.eventId || "",
      type: link.type || "register",
      slug: link.slug || "",
      targetUrl: link.targetUrl || "",
      createdAt: link.createdAt || "",
    });
  };

  const handleShortLinkDelete = async (slug) => {
    if (!slug) {
      return;
    }
    setSaving(true);
    try {
      const { result } = await apiRequest({ action: "deleteShortLink", slug: slug });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadShortLinks();
    } catch (err) {
      setError(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const buildShortLinkUrl = (link) => {
    if (!link || !link.eventId) {
      return "";
    }
    if (link.type === "checkin") {
      return `${window.location.origin}/checkin?eventId=${encodeURIComponent(link.eventId)}`;
    }
    if (!link.slug) {
      return "";
    }
    return `${window.location.origin}/?eventId=${encodeURIComponent(
      link.eventId
    )}&slug=${encodeURIComponent(link.slug)}`;
  };

  const handleRegistrationEdit = (registration) => {
    setRegistrationForm({
      id: registration.id || "",
      status: registration.status || "registered",
    });
  };

  const handleRegistrationSubmit = async (event) => {
    event.preventDefault();
    if (!registrationForm.id) {
      setError("請先選擇報名紀錄。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "updateRegistration", data: registrationForm });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      setRegistrationForm({ id: "", status: "registered" });
      await loadRegistrations();
    } catch (err) {
      setError(err.message || "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrationDelete = async (id) => {
    if (!id) {
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
          <span className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm sm:inline-flex">
            管理者模式
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 pb-28 pt-10 sm:px-12">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-6">
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
            {[
              { id: "events", label: "活動" },
              { id: "registrations", label: "報名" },
              { id: "checkins", label: "簽到" },
              { id: "students", label: "同學" },
              { id: "shortlinks", label: "短鏈結" },
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

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {activeTab === "events"
                ? "活動列表"
                : activeTab === "registrations"
                ? "報名名單"
                : activeTab === "checkins"
                ? "簽到名單"
                : activeTab === "students"
                ? "同學名單"
                : "短鏈結"}
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
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{event.title}</p>
                    <p className="text-xs text-slate-500">
                      {event.startAt} · {event.location}
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

          {activeTab === "registrations" ? (
            <div className="mt-6 space-y-4">
              {registrations.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.userName}</p>
                    <p className="text-xs text-slate-500">
                      {item.eventId} · {item.userEmail}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRegistrationEdit(item)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      更新狀態
                    </button>
                    <button
                      onClick={() => handleRegistrationDelete(item.id)}
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

          {activeTab === "checkins" ? (
            <div className="mt-6 space-y-4">
              {checkins.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.registrationId}</p>
                    <p className="text-xs text-slate-500">
                      {item.eventId} · {item.checkinAt}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCheckinDelete(item.id)}
                    disabled={saving}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    刪除
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "students" ? (
            <div className="mt-6 space-y-4">
              {students.map((item) => (
                <div
                  key={item.id || item.name}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.id} · {item.googleEmail || "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStudentEdit(item)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => handleStudentDelete(item.id)}
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

          {activeTab === "shortlinks" ? (
            <div className="mt-6 space-y-4">
              {shortLinks.map((item) => (
                <div
                  key={item.slug}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.slug}</p>
                    <p className="text-xs text-slate-500">
                      {item.eventId} · {item.type}
                    </p>
                    {buildShortLinkUrl(item) ? (
                      <a
                        href={buildShortLinkUrl(item)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        {buildShortLinkUrl(item)}
                      </a>
                    ) : null}
                  </div>
                  {item.type === "checkin" && buildShortLinkUrl(item) ? (
                    <div className="flex items-center gap-3">
                      <img
                        alt="Check-in QR Code"
                        className="h-20 w-20 rounded-xl border border-slate-200 bg-white p-1"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                          buildShortLinkUrl(item)
                        )}`}
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleShortLinkEdit(item)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => handleShortLinkDelete(item.slug)}
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
        </section>

        {activeTab === "events" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">
              {activeId ? "編輯活動" : "新增活動"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">活動 ID</label>
              <input
                value={form.id}
                onChange={(event) => handleChange("id", event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              />
              <p className="text-xs text-slate-400">
                建議格式: EVT-YYYYMMDD-###，系統會自動預填。
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
                placeholder="https://your-domain/register?eventId=EVT-..."
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
                placeholder="https://your-domain/checkin?eventId=EVT-..."
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
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">活動類別</label>
              <select
                value={form.category}
                onChange={(event) => handleCategoryChange(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
              >
                <option value="gathering">聚餐</option>
                <option value="meeting">開會</option>
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
            <h2 className="text-lg font-semibold text-slate-900">維護同學資料</h2>
            <form onSubmit={handleStudentSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">學號</label>
                <input
                  value={studentForm.id}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, id: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">姓名</label>
                <input
                  value={studentForm.name}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Google Email</label>
                <input
                  value={studentForm.googleEmail}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, googleEmail: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Google Sub</label>
                <input
                  value={studentForm.googleSub}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, googleSub: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "儲存中..." : "儲存同學資料"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setStudentForm({
                      id: "",
                      name: "",
                      googleSub: "",
                      googleEmail: "",
                    })
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  清除表單
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {activeTab === "shortlinks" ? (
          <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">維護短鏈結</h2>
            <form onSubmit={handleShortLinkSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Slug</label>
                <input
                  value={shortLinkForm.slug}
                  onChange={(event) => setShortLinkForm((prev) => ({ ...prev, slug: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">活動 ID</label>
                <input
                  value={shortLinkForm.eventId}
                  onChange={(event) => setShortLinkForm((prev) => ({ ...prev, eventId: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">類型</label>
                <select
                  value={shortLinkForm.type}
                  onChange={(event) => setShortLinkForm((prev) => ({ ...prev, type: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                >
                  <option value="register">報名</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Target URL</label>
                <input
                  value={shortLinkForm.targetUrl}
                  onChange={(event) => setShortLinkForm((prev) => ({ ...prev, targetUrl: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">建立時間</label>
                <input
                  value={shortLinkForm.createdAt}
                  onChange={(event) => setShortLinkForm((prev) => ({ ...prev, createdAt: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "儲存中..." : "儲存短鏈結"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setShortLinkForm({
                      id: "",
                      eventId: "",
                      type: "register",
                      slug: "",
                      targetUrl: "",
                      createdAt: "",
                    })
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  清除表單
                </button>
              </div>
            </form>
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
            <span className="text-xs text-slate-400">共 {directory.length} 筆</span>
          </div>
          <div className="mt-6 space-y-4">
            {directory.map((item) => (
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
  const prefix = "EVT";
  const ymd = `${date.getFullYear()}${pad2_(date.getMonth() + 1)}${pad2_(date.getDate())}`;
  const categoryCode = category === "meeting" ? "M" : "G";
  const base = `${prefix}-${ymd}-${categoryCode}`;
  const suffixes = (events || [])
    .map((event) => String(event.id || ""))
    .filter((id) => id.startsWith(base))
    .map((id) => id.split("-").slice(-1)[0])
    .map((value) => parseInt(value, 10))
    .filter((value) => !isNaN(value));
  const seedValue = seed ? new Date(seed) : new Date();
  const seedDay = `${seedValue.getFullYear()}${pad2_(seedValue.getMonth() + 1)}${pad2_(
    seedValue.getDate()
  )}`;
  const baseIndex = parseInt(seedDay.slice(-2), 10) % 99;
  const next = suffixes.length ? Math.max.apply(null, suffixes) + 1 : baseIndex + 1;
  return `${base}-${String(next).padStart(2, "0")}`;
}
