import React, { useEffect, useMemo, useRef, useState } from "react";

function SoftballPlayerPage({ shared }) {

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
  } = shared;

  const [activeTab, setActiveTab] = useState("profile");
  const [players, setPlayers] = useState([]);
  const [practices, setPractices] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
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

  const loadBootstrap = async (studentId) => {
    try {
      const { result } = await apiRequest({
        action: "listSoftballPlayerBootstrap",
        studentId: studentId,
      });
      if (result && result.ok) {
        const data = result.data || {};
        setPlayers(data.players || []);
        const list = data.practices || [];
        const sorted = list.slice().sort((a, b) => String(b.date || "").localeCompare(a.date || ""));
        setPractices(sorted);
        setPracticesUpdatedAt(new Date());
        setFields(data.fields || []);
        setSoftballConfig(data.config || {});
        if (Array.isArray(data.attendance)) {
          setAttendance(data.attendance);
          setAttendanceLoaded(true);
        }
        return;
      }
    } catch (error) {
      // Fall back to legacy endpoints below.
    }

    await Promise.all([
      loadPlayers(),
      loadPractices(),
      loadFields(),
      apiRequest({ action: "listSoftballConfig" }).then(({ result }) => {
        if (result && result.ok) {
          setSoftballConfig(result.data && result.data.config ? result.data.config : {});
        }
      }),
      studentId ? loadAttendance(studentId) : Promise.resolve(),
    ]);
  };

  const loadAttendance = async (studentId) => {
    if (!studentId) {
      setAttendance([]);
      setAttendanceLoaded(true);
      return;
    }
    try {
      const { result } = await apiRequest({
        action: "listSoftballAttendance",
        studentId: studentId,
      });
      if (!result.ok) {
        setError(`出席資料載入失敗：${result.error || "載入失敗"}`);
        setAttendance([]);
        setAttendanceLoaded(true);
        return;
      }
      const list = result.data && result.data.attendance ? result.data.attendance : [];
      setAttendance(list);
      setAttendanceLoaded(true);
    } catch (err) {
      setError(`出席資料載入失敗：${err.message || "載入失敗"}`);
      setAttendance([]);
      setAttendanceLoaded(true);
    }
  };

  useEffect(() => {
    let ignore = false;
    const loadAll = async () => {
      setLoading(true);
      setError("");
      try {
        await loadBootstrap(googleLinkedStudent && googleLinkedStudent.id);
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
      if (!attendanceLoaded) {
        loadAttendance(googleLinkedStudent.id);
      }
    }
  }, [googleLinkedStudent, attendanceLoaded]);

  useEffect(() => {
    setAttendanceLoaded(false);
  }, [googleLinkedStudent && googleLinkedStudent.id]);

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
        phone: normalizePhoneInputValue_(match.phone),
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
        phone: normalizePhoneInputValue_(googleLinkedStudent.phone),
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
        phone: normalizePhoneInputValue_(profileForm.phone),
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

  const normalizeCsvValue_ = (value) => {
    if (!value) {
      return "";
    }
    if (Array.isArray(value)) {
      return value.join(",");
    }
    return String(value);
  };

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
  const jerseyChoices = normalizeCsvValue_(profileForm.jerseyChoices)
    .split(",")
    .map((value) => formatJerseyLabel_(value.trim()))
    .filter(Boolean);

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
      <div className="mx-auto mt-4 max-w-6xl px-6 sm:px-12">
        <a
          href="/"
          className="btn-chip sm:px-4 sm:text-xs"
        >
          回首頁
        </a>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-12">
        <section className="mb-6 card p-4 sm:p-6">
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
          <div className="mb-6 alert alert-warning">
            {statusMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 alert alert-error">
            {error}
          </div>
        ) : null}

        {activeTab === "profile" ? (
          <section className="card p-7 sm:p-10">
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
                  className="input-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">稱呼</label>
                <input
                  value={profileForm.preferredName}
                  onChange={(event) => handleProfileChange("preferredName", event.target.value)}
                  className="input-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  value={profileForm.email}
                  onChange={(event) => handleProfileChange("email", event.target.value)}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="input-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">聯絡電話</label>
                <input
                  value={profileForm.phone}
                  onChange={(event) => handleProfileChange("phone", event.target.value)}
                  type="text"
                  inputMode="tel"
                  autoComplete="tel"
                  className="input-sm"
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
                  className="input-sm"
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
                    className="input-sm"
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
                    className="input-sm"
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
                  className="btn-primary"
                >
                  {saving ? "送出中..." : "送出申請"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {activeTab === "attendance" ? (
          <section className="card p-7 sm:p-10">
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
                  className="btn-chip disabled:opacity-60"
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
                    className="btn-chip"
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

export default SoftballPlayerPage;
