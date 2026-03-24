import React, { useEffect, useMemo, useRef, useState } from "react";

function SoftballPage({ shared }) {

  const {
    apiRequest,
    authedApiRequest,
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

  const effectiveApiRequest =
    typeof authedApiRequest === "function" ? authedApiRequest : apiRequest;

  const [activeTab, setActiveTab] = useState("overview");
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);
  const [practices, setPractices] = useState([]);
  const [fields, setFields] = useState([]);
  const [gear, setGear] = useState([]);
  const [angelRoster, setAngelRoster] = useState([]);
  const [supplyVendors, setSupplyVendors] = useState([]);
  const [supplyCases, setSupplyCases] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [statsAttendance, setStatsAttendance] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [statsScope, setStatsScope] = useState("recent10");
  const [students, setStudents] = useState([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [softballConfig, setSoftballConfig] = useState({});
  const [jerseyDeadline, setJerseyDeadline] = useState("");
  const [activePracticeId, setActivePracticeId] = useState("");
  const [supplySubtab, setSupplySubtab] = useState("cases");
  const [playerForm, setPlayerForm] = useState({
    id: "",
    name: "",
    nameEn: "",
    preferredName: "",
    email: "",
    phone: "",
    jerseyNumber: "",
    jerseySize: "",
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
  const [angelForm, setAngelForm] = useState({
    id: "",
    studentId: "",
    status: "active",
    joinedAt: "",
    notes: "",
  });
  const [vendorForm, setVendorForm] = useState({
    id: "",
    name: "",
    category: "",
    phone: "",
    contact: "",
    deliveryNote: "",
    minOrderAmount: "",
    status: "active",
    notes: "",
  });
  const [supplyCaseForm, setSupplyCaseForm] = useState({
    id: "",
    title: "",
    practiceId: "",
    angelRosterId: "",
    angelStudentId: "",
    vendorId: "",
    vendorIds: ["", "", ""],
    angelStatus: "unassigned",
    orderStatus: "not_started",
    plannedHeadcount: "",
    totalAmount: "",
    orderedAt: "",
    notes: "",
    items: [],
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
  const JERSEY_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "2L", "3L", "5L", "6L"];
  const SUPPLY_ITEM_TYPE_OPTIONS = ["飲料", "點心", "水果", "輕食", "冰品", "其他"];
  const SUPPLY_ITEM_UNIT_OPTIONS = ["份", "杯", "瓶", "箱", "包", "個", "串"];

  const buildEmptySupplyItem_ = () => ({
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "飲料",
    name: "",
    qty: "",
    unit: "份",
    amount: "",
    notes: "",
  });

  const buildEmptySupplyCaseForm_ = (practiceId = "") => ({
    id: "",
    title: "",
    practiceId,
    angelRosterId: "",
    angelStudentId: "",
    vendorId: "",
    vendorIds: ["", "", ""],
    angelStatus: "unassigned",
    orderStatus: "not_started",
    plannedHeadcount: "",
    totalAmount: "",
    orderedAt: "",
    notes: "",
    items: [buildEmptySupplyItem_()],
  });

  const normalizeId_ = (value) => String(value || "").trim();

  const statusTimerRef = useRef(null);
  const flashStatusMessage_ = (message, timeoutMs = 2500) => {
    setStatusMessage(String(message || "").trim());
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage("");
    }, timeoutMs);
  };

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  const copyTextToClipboard_ = async (text, successMessage = "已複製") => {
    const value = String(text || "");
    if (!value.trim()) {
      flashStatusMessage_("沒有內容可複製");
      return;
    }

    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof window !== "undefined" &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(value);
        flashStatusMessage_(successMessage);
        return;
      }
      throw new Error("Clipboard unavailable");
    } catch (err) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        textarea.style.left = "-1000px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (ok) {
          flashStatusMessage_(successMessage);
          return;
        }
      } catch (error) {
        // Fall through to prompt.
      }
      window.prompt("複製以下文字", value);
    }
  };

  const getStudentDisplayName_ = (student) =>
    String(
      (student && (student.preferredName || student.nameZh || student.nameEn || student.name)) || ""
    ).trim();

  const getStudentChineseName_ = (student) =>
    String((student && (student.nameZh || student.name || student.preferredName || student.nameEn)) || "").trim();

  const getResolvedPlayerChineseName_ = (player, student) =>
    String(
      (player && player.name) || (student && (student.nameZh || student.name)) || ""
    ).trim();

  const getResolvedPlayerAlias_ = (player, student) =>
    String(
      (player && (player.preferredName || player.nickname || player.nameEn)) ||
        (student && (student.preferredName || student.nameEn)) ||
        ""
    ).trim();

  const getPlayerDisplayName_ = (player, student = null) =>
    String(
      getResolvedPlayerChineseName_(player, student) ||
        getResolvedPlayerAlias_(player, student) ||
        (player && (player.email || player.id)) ||
        (student && (student.email || student.id)) ||
        ""
    ).trim();

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

  const loadSoftballBootstrap = async () => {
    const { result } = await effectiveApiRequest({ action: "listSoftballBootstrap" });
    if (!result.ok) {
      throw new Error(result.error || "載入失敗");
    }
    const data = result.data || {};
    const practicesList = data.practices ? data.practices.slice().sort((a, b) => getPracticeSortKey_(a) - getPracticeSortKey_(b)) : [];
    const config = data.config || {};
    setSoftballConfig(config);
    setJerseyDeadline(config.jerseyDeadline || "");
    setPlayers(data.players || []);
    setPractices(practicesList);
    setFields(data.fields || []);
    setGear(data.gear || []);
    setAngelRoster(data.angels || []);
    setSupplyVendors(data.vendors || []);
    setSupplyCases(data.supplyCases || []);
  };

  const loadPlayers = async () => {
    try {
      const { result } = await effectiveApiRequest({ action: "listSoftballPlayers" });
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
      const { result } = await effectiveApiRequest({ action: "listSoftballPractices" });
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
      const { result } = await effectiveApiRequest({ action: "listSoftballFields" });
      if (!result.ok) {
        setError(`球場資料載入失敗：${result.error || "載入失敗"}`);
        setFields([]);
        return;
      }
      setFields(result.data && result.data.fields ? result.data.fields : []);
    } catch (err) {
      setError(`球場資料載入失敗：${err.message || "載入失敗"}`);
      setFields([]);
    }
  };

  const loadGear = async () => {
    try {
      const { result } = await effectiveApiRequest({ action: "listSoftballGear" });
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
      const { result } = await effectiveApiRequest({
        action: "listSoftballAttendance",
        practiceId: practiceId,
      });
      if (!result.ok) {
        setError(`出席資料載入失敗：${result.error || "載入失敗"}`);
        setAttendance([]);
        return;
      }
      setAttendance(result.data && result.data.attendance ? result.data.attendance : []);
    } catch (err) {
      setError(`出席資料載入失敗：${err.message || "載入失敗"}`);
      setAttendance([]);
    }
  };

  const loadStatsAttendance = async () => {
    if (statsLoading) {
      return;
    }
    setStatsLoading(true);
    setStatsError("");
    try {
      const { result } = await effectiveApiRequest({ action: "listSoftballAttendance" });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      setStatsAttendance(result.data && result.data.attendance ? result.data.attendance : []);
    } catch (err) {
      setStatsError(err.message || "出席統計載入失敗");
      setStatsAttendance([]);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadSoftballConfig = async () => {
    try {
      const { result } = await effectiveApiRequest({ action: "listSoftballConfig" });
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

  const loadStudents = async () => {
    if (studentsLoading) {
      return;
    }
    setStudentsLoading(true);
    try {
      const { result } = await effectiveApiRequest({ action: "listStudents" });
      if (result.ok) {
        setStudents(result.data && result.data.students ? result.data.students : []);
      } else {
        setStudents([]);
      }
    } catch (err) {
      setStudents([]);
    } finally {
      setStudentsLoaded(true);
      setStudentsLoading(false);
    }
  };

  const loadMemberships = async () => {
    try {
      const { result } = await effectiveApiRequest({ action: "listSoftballMemberships" });
      if (result.ok) {
        setMemberships(result.data && result.data.memberships ? result.data.memberships : []);
      } else {
        setMemberships([]);
      }
    } catch (err) {
      setMemberships([]);
    } finally {
      setMembershipsLoaded(true);
    }
  };

  useEffect(() => {
    let ignore = false;
    const loadAll = async () => {
      setInitialLoading(true);
      setError("");
      try {
        await loadSoftballBootstrap();
      } catch (err) {
        if (!ignore) {
          setError(err.message || "壘球後台資料載入失敗");
        }
      } finally {
        if (!ignore) {
          setInitialLoading(false);
        }
      }
    };
    loadAll();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const needsStudents =
      activeTab === "players" ||
      activeTab === "attendance" ||
      activeTab === "stats" ||
      activeTab === "roles" ||
      activeTab === "supply";
    if (!needsStudents || studentsLoaded || studentsLoading) {
      return;
    }
    loadStudents();
  }, [activeTab, studentsLoaded, studentsLoading]);

  useEffect(() => {
    const needsMemberships = activeTab === "roles";
    if (!needsMemberships || membershipsLoaded) {
      return;
    }
    loadMemberships();
  }, [activeTab, membershipsLoaded]);

  useEffect(() => {
    if (activePracticeId) {
      loadAttendance(activePracticeId);
    }
  }, [activePracticeId]);

  useEffect(() => {
    if (activeTab === "stats") {
      loadStatsAttendance();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "supply" && (!supplyCaseForm.items || !supplyCaseForm.items.length)) {
      setSupplyCaseForm((prev) => ({ ...prev, items: [buildEmptySupplyItem_()] }));
    }
  }, [activeTab, supplyCaseForm.items]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayKey =
    todayStart.getFullYear() * 10000 + (todayStart.getMonth() + 1) * 100 + todayStart.getDate();
  const nextPractice =
    practices.find((practice) => getPracticeDayKey_(practice) >= todayKey) || practices[0] || null;
  const isPracticeExpired_ = (practice) => {
    const dayKey = getPracticeDayKey_(practice);
    if (!dayKey) {
      return true;
    }
    return dayKey < todayKey;
  };
  const practiceListItems = practices.slice().sort((a, b) => {
    const aExpired = isPracticeExpired_(a);
    const bExpired = isPracticeExpired_(b);
    if (aExpired !== bExpired) {
      return aExpired ? 1 : -1;
    }
    const aSort = getPracticeSortKey_(a);
    const bSort = getPracticeSortKey_(b);
    if (!aExpired) {
      return aSort - bSort;
    }
    return bSort - aSort;
  });
  const selectedPractice =
    practices.find((practice) => normalizeId_(practice.id) === normalizeId_(activePracticeId)) ||
    null;

  const studentById = students.reduce((acc, student) => {
    const id = normalizeId_(student && student.id);
    if (id) {
      acc[id] = student;
    }
    return acc;
  }, {});

  const playerById = players.reduce((acc, player) => {
    const id = normalizeId_(player && player.id);
    if (id) {
      acc[id] = player;
    }
    return acc;
  }, {});

  const practiceById = practices.reduce((acc, practice) => {
    const id = normalizeId_(practice && practice.id);
    if (id) {
      acc[id] = practice;
    }
    return acc;
  }, {});

  const supplyVendorById = supplyVendors.reduce((acc, vendor) => {
    const id = normalizeId_(vendor && vendor.id);
    if (id) {
      acc[id] = vendor;
    }
    return acc;
  }, {});

  const angelById = angelRoster.reduce((acc, angel) => {
    const id = normalizeId_(angel && angel.id);
    if (id) {
      acc[id] = angel;
    }
    return acc;
  }, {});

  const getPersonDisplayName_ = (personId) => {
    const id = normalizeId_(personId);
    const student = studentById[id];
    const player = playerById[id];
    return String(
      (player && (player.name || player.preferredName || player.nickname)) ||
        (student && (student.nameZh || student.name || student.preferredName || student.nameEn)) ||
        id
    ).trim();
  };

  const supplyCaseByPracticeId = supplyCases.reduce((acc, item) => {
    const practiceId = normalizeId_(item && item.practiceId);
    if (practiceId && !acc[practiceId]) {
      acc[practiceId] = item;
    }
    return acc;
  }, {});

  const angelStatsByStudentId = supplyCases.reduce((acc, item) => {
    const studentId = normalizeId_(item && item.angelStudentId);
    const practice = practiceById[normalizeId_(item && item.practiceId)] || null;
    const practiceKey = practice ? getPracticeSortKey_(practice) : 0;
    if (!studentId) {
      return acc;
    }
    if (!acc[studentId]) {
      acc[studentId] = { count: 0, lastPracticeKey: 0, lastPracticeLabel: "" };
    }
    acc[studentId].count += 1;
    if (practiceKey >= acc[studentId].lastPracticeKey) {
      acc[studentId].lastPracticeKey = practiceKey;
      acc[studentId].lastPracticeLabel = practice ? formatPracticeDate_(practice.date || practice.startAt) : "";
    }
    return acc;
  }, {});

  const activeAngelOptions = angelRoster
    .filter((item) => String(item.status || "active").trim() !== "retired")
    .slice()
    .sort((a, b) => {
      const left = getPersonDisplayName_(a.studentId);
      const right = getPersonDisplayName_(b.studentId);
      return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
    });

  const sortedAngelRoster = angelRoster.slice().sort((a, b) => {
    const left = getPersonDisplayName_(a.studentId);
    const right = getPersonDisplayName_(b.studentId);
    return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
  });

  const sortedSupplyVendors = supplyVendors.slice().sort((a, b) => {
    const left = String(a.name || "");
    const right = String(b.name || "");
    return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
  });

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

  const handleAngelFormChange = (key, value) => {
    setAngelForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleVendorFormChange = (key, value) => {
    setVendorForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSupplyCaseFormChange = (key, value) => {
    setSupplyCaseForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSupplyVendorSlotChange = (index, value) => {
    setSupplyCaseForm((prev) => {
      const nextVendorIds = Array.isArray(prev.vendorIds) ? prev.vendorIds.slice(0, 3) : ["", "", ""];
      while (nextVendorIds.length < 3) {
        nextVendorIds.push("");
      }
      nextVendorIds[index] = value;
      const normalized = nextVendorIds.filter((item, idx, list) => item && list.indexOf(item) === idx);
      const padded = [normalized[0] || "", normalized[1] || "", normalized[2] || ""];
      return {
        ...prev,
        vendorIds: padded,
        vendorId: padded[0] || "",
      };
    });
  };

  const handleSupplyItemChange = (localId, key, value) => {
    setSupplyCaseForm((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) =>
        item.localId === localId ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addSupplyItem = () => {
    setSupplyCaseForm((prev) => ({ ...prev, items: [...(prev.items || []), buildEmptySupplyItem_()] }));
  };

  const removeSupplyItem = (localId) => {
    setSupplyCaseForm((prev) => {
      const nextItems = (prev.items || []).filter((item) => item.localId !== localId);
      return { ...prev, items: nextItems.length ? nextItems : [buildEmptySupplyItem_()] };
    });
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
      jerseySize: "",
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
      const { result } = await effectiveApiRequest({
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

  const resetAngelForm = () => {
    setAngelForm({
      id: "",
      studentId: "",
      status: "active",
      joinedAt: "",
      notes: "",
    });
  };

  const resetVendorForm = () => {
    setVendorForm({
      id: "",
      name: "",
      category: "",
      phone: "",
      contact: "",
      deliveryNote: "",
      minOrderAmount: "",
      status: "active",
      notes: "",
    });
  };

  const resetSupplyCaseForm = (practiceId = "") => {
    setSupplyCaseForm(buildEmptySupplyCaseForm_(practiceId));
  };

  const buildSupplyCaseFormFromCase_ = (item) => {
    const rawVendorIds = Array.isArray(item && item.vendorIds)
      ? item.vendorIds
      : item && item.vendorId
      ? [item.vendorId]
      : [];
    return {
      id: item && item.id ? item.id : "",
      title: item && item.title ? item.title : "",
      practiceId: item && item.practiceId ? item.practiceId : "",
      angelRosterId: item && item.angelRosterId ? item.angelRosterId : "",
      angelStudentId: item && item.angelStudentId ? item.angelStudentId : "",
      vendorId: rawVendorIds[0] || (item && item.vendorId ? item.vendorId : ""),
      vendorIds: [rawVendorIds[0] || "", rawVendorIds[1] || "", rawVendorIds[2] || ""],
      angelStatus: item && item.angelStatus ? item.angelStatus : "unassigned",
      orderStatus: item && item.orderStatus ? item.orderStatus : "not_started",
      plannedHeadcount: item && item.plannedHeadcount != null ? String(item.plannedHeadcount) : "",
      totalAmount: item && item.totalAmount != null ? String(item.totalAmount) : "",
      orderedAt: item && item.orderedAt ? item.orderedAt : "",
      notes: item && item.notes ? item.notes : "",
      items:
        item && Array.isArray(item.items) && item.items.length
          ? item.items.map((row, index) => ({
              localId: `${item.id || "case"}-${index}`,
              type: row.type || "飲料",
              name: row.name || "",
              qty: row.qty || "",
              unit: row.unit || "份",
              amount: row.amount || "",
              notes: row.notes || "",
            }))
          : [buildEmptySupplyItem_()],
    };
  };

  const selectSupplyPractice_ = (practiceId) => {
    const existing = supplyCaseByPracticeId[normalizeId_(practiceId)];
    if (existing) {
      setSupplyCaseForm(buildSupplyCaseFormFromCase_(existing));
      return;
    }
    resetSupplyCaseForm(practiceId);
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
      const { result } = await effectiveApiRequest({ action: "updateSoftballPlayer", data: payload });
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
      const { result } = await effectiveApiRequest({ action: action, data: playerForm });
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
      const { result } = await effectiveApiRequest(payload);
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
      const { result } = await effectiveApiRequest(payload);
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
      const { result } = await effectiveApiRequest(payload);
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
      const { result } = await effectiveApiRequest({ action: "deleteSoftballPlayer", id: id });
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
      const { result } = await effectiveApiRequest({ action: "deleteSoftballPractice", id: id });
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
      const { result } = await effectiveApiRequest({ action: "deleteSoftballField", id: id });
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
      const { result } = await effectiveApiRequest({ action: "deleteSoftballGear", id: id });
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

  const handleSaveAngel = async (event) => {
    event.preventDefault();
    if (!angelForm.studentId) {
      setStatusMessage("請先選擇天使同學");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const action = angelForm.id ? "updateSoftballAngel" : "createSoftballAngel";
      const payload = angelForm.id ? { action, id: angelForm.id, data: angelForm } : { action, data: angelForm };
      const { result } = await effectiveApiRequest(payload);
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      await loadSoftballBootstrap();
      resetAngelForm();
      setStatusMessage("已更新天使名單");
    } catch (err) {
      setStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAngel = async (id) => {
    if (!id) {
      return;
    }
    if (!confirmDelete_("確定要將這位同學移出天使名單嗎？")) {
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await effectiveApiRequest({ action: "deleteSoftballAngel", id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadSoftballBootstrap();
      resetAngelForm();
      setStatusMessage("已更新天使名單");
    } catch (err) {
      setStatusMessage(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVendor = async (event) => {
    event.preventDefault();
    if (!vendorForm.name) {
      setStatusMessage("請先填店家名稱");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const action = vendorForm.id ? "updateSoftballSupplyVendor" : "createSoftballSupplyVendor";
      const payload = vendorForm.id ? { action, id: vendorForm.id, data: vendorForm } : { action, data: vendorForm };
      const { result } = await effectiveApiRequest(payload);
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      await loadSoftballBootstrap();
      resetVendorForm();
      setStatusMessage("已更新補給店家");
    } catch (err) {
      setStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async (id) => {
    if (!id) {
      return;
    }
    const vendorLabel = supplyVendors.find((item) => normalizeId_(item.id) === normalizeId_(id))?.name || id;
    if (!confirmDelete_(`確定要刪除店家「${vendorLabel}」嗎？`)) {
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await effectiveApiRequest({ action: "deleteSoftballSupplyVendor", id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadSoftballBootstrap();
      resetVendorForm();
      setStatusMessage("已刪除店家");
    } catch (err) {
      setStatusMessage(err.message || "刪除失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSupplyCase = async (event) => {
    event.preventDefault();
    if (!supplyCaseForm.practiceId) {
      setStatusMessage("請先選擇練習");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const selectedAngel = angelRoster.find((item) => normalizeId_(item.id) === normalizeId_(supplyCaseForm.angelRosterId));
      const vendorIds = (Array.isArray(supplyCaseForm.vendorIds) ? supplyCaseForm.vendorIds : [])
        .map((value) => String(value || "").trim())
        .filter((value, index, list) => value && list.indexOf(value) === index)
        .slice(0, 3);
      const payloadData = {
        ...supplyCaseForm,
        title: "",
        vendorIds,
        vendorId: vendorIds[0] || "",
        angelStudentId: supplyCaseForm.angelStudentId || (selectedAngel ? selectedAngel.studentId || "" : ""),
        items: (supplyCaseForm.items || [])
          .map((item) => ({
            type: item.type || "",
            name: item.name || "",
            qty: item.qty || "",
            unit: item.unit || "",
            amount: item.amount || "",
            notes: item.notes || "",
          }))
          .filter((item) => item.name || item.qty || item.amount || item.notes),
      };
      const action = supplyCaseForm.id ? "updateSoftballSupplyCase" : "createSoftballSupplyCase";
      const payload = supplyCaseForm.id ? { action, id: supplyCaseForm.id, data: payloadData } : { action, data: payloadData };
      const { result } = await effectiveApiRequest(payload);
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      await loadSoftballBootstrap();
      setSupplyCaseForm(
        buildSupplyCaseFormFromCase_({
          ...payloadData,
          id: result.data && result.data.id ? result.data.id : supplyCaseForm.id,
        })
      );
      setStatusMessage("已更新補給案件");
    } catch (err) {
      setStatusMessage(err.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplyCase = async (id) => {
    if (!id) {
      return;
    }
    if (!confirmDelete_("確定要刪除這筆補給案件嗎？")) {
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const { result } = await effectiveApiRequest({ action: "deleteSoftballSupplyCase", id });
      if (!result.ok) {
        throw new Error(result.error || "刪除失敗");
      }
      await loadSoftballBootstrap();
      resetSupplyCaseForm();
      setStatusMessage("已刪除補給案件");
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
      const { result } = await effectiveApiRequest({
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

  const formatCsvCell_ = (value) => {
    const raw = String(value == null ? "" : value);
    if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const formatJerseyNumber_ = (value) => {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    if (/^\d+$/.test(raw)) {
      return raw.padStart(2, "0");
    }
    return raw;
  };

  const handleExportJerseyInfo = async () => {
    if (typeof window === "undefined") {
      return;
    }

    let studentRoster = Array.isArray(students) ? students.slice() : [];
    if (!studentRoster.length) {
      try {
        const { result } = await effectiveApiRequest({ action: "listStudents" });
        if (result && result.ok && result.data && Array.isArray(result.data.students)) {
          studentRoster = result.data.students.slice();
          setStudents(studentRoster);
          setStudentsLoaded(true);
        }
      } catch (error) {
        // Keep export available even if student roster fails to load.
      }
    }

    const rosterById = {};
    studentRoster.forEach((student) => {
      const studentId = normalizeId_(student && student.id);
      if (studentId) {
        rosterById[studentId] = student;
      }
    });

    const registeredRows = players
      .slice()
      .sort((a, b) => {
        const leftJersey = formatJerseyNumber_(a.jerseyNumber);
        const rightJersey = formatJerseyNumber_(b.jerseyNumber);
        if (leftJersey && rightJersey && leftJersey !== rightJersey) {
          return leftJersey.localeCompare(rightJersey, "zh-Hant", { numeric: true });
        }
        if (leftJersey && !rightJersey) {
          return -1;
        }
        if (!leftJersey && rightJersey) {
          return 1;
        }
        return String(a.nickname || a.name || "").localeCompare(
          String(b.nickname || b.name || ""),
          "zh-Hant",
          { numeric: true }
        );
      })
      .map((player) => {
        const playerId = normalizeId_(player.id);
        const matchedStudent = playerId ? rosterById[playerId] : null;
        return {
          name: String(player.name || getStudentDisplayName_(matchedStudent) || "").trim(),
          nickname: String(player.nickname || "").trim(),
          jerseyNumber: formatJerseyNumber_(player.jerseyNumber),
          jerseySize: String(player.jerseySize || "").trim(),
        };
      });

    const registeredIdSet = new Set(
      players.map((player) => normalizeId_(player.id)).filter((id) => id)
    );
    const unregisteredRows = studentRoster
      .filter((student) => {
        const studentId = normalizeId_(student && student.id);
        return studentId && !registeredIdSet.has(studentId);
      })
      .sort((a, b) =>
        String(getStudentDisplayName_(a) || "").localeCompare(
          String(getStudentDisplayName_(b) || ""),
          "zh-Hant",
          { numeric: true }
        )
      )
      .map((student) => ({
        name: String(getStudentDisplayName_(student) || "").trim(),
        nickname: "",
        jerseyNumber: "",
        jerseySize: "",
      }));

    const exportRows = registeredRows.concat(unregisteredRows);

    const rows = [];
    const pushRow_ = (values) => rows.push(values.map(formatCsvCell_).join(","));
    pushRow_(["流水序號", "姓名", "球員暱稱", "背號", "球衣尺寸"]);

    exportRows.forEach((item, index) => {
      pushRow_([
        index + 1,
        item.name,
        item.nickname,
        item.jerseyNumber,
        item.jerseySize,
      ]);
    });

    if (!exportRows.length) {
      pushRow_(["", "(無資料)", "", "", ""]);
    }

    const csv = rows.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d+Z$/, "")
      .slice(0, 15);
    link.href = url;
    link.download = `softball-jersey-export-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    setStatusMessage(
      `已匯出球衣資料 ${exportRows.length} 筆（已登錄 ${registeredRows.length}、未登錄 ${unregisteredRows.length}）`
    );
  };

  const filteredPlayers = players.filter((player) => {
    const matchedStudent = studentById[normalizeId_(player && player.id)] || null;
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
      player.jerseySize,
      player.positions,
      matchedStudent && matchedStudent.nameZh,
      matchedStudent && matchedStudent.name,
      matchedStudent && matchedStudent.preferredName,
      matchedStudent && matchedStudent.nameEn,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(needle);
  });

  const registeredIdSet = new Set(
    players.map((player) => normalizeId_(player.id)).filter((id) => id)
  );
  const sortedStudents = students
    .slice()
    .sort((a, b) =>
      getStudentDisplayName_(a).localeCompare(getStudentDisplayName_(b))
    );
  const registeredStudents = sortedStudents.filter((student) =>
    registeredIdSet.has(normalizeId_(student.id))
  );
  const unregisteredStudents = sortedStudents.filter(
    (student) => !registeredIdSet.has(normalizeId_(student.id))
  );

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

  const attendanceStats = filteredPlayers.reduce(
    (acc, player) => {
      const record = attendanceByStudent[normalizeId_(player.id)] || {};
      const status = String(record.status || "unknown").toLowerCase();
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
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            壘球隊管理 · 後台
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            職業等級的隊務管理：球員、練習、場地、出席、器材與日誌。
          </p>
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
        <section className="mb-6 card p-4 sm:p-6">
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
            {[
              { id: "overview", label: "總覽" },
              { id: "practices", label: "練習排程" },
              { id: "attendance", label: "點名" },
              { id: "players", label: "球員" },
              { id: "fields", label: "球場" },
              { id: "gear", label: "器材" },
              { id: "supply", label: "天使補給" },
              { id: "stats", label: "統計" },
              { id: "roles", label: "角色權限" },
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

        {initialLoading ? (
          <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
              <span className="font-medium">壘球後台資料載入中…</span>
            </div>
            <p className="mt-1 text-xs text-sky-700">先顯示排程與提醒，其他資料會在背景補齊。</p>
          </div>
        ) : null}

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

        {activeTab === "overview" ? (
          <section className="card p-7 sm:p-10">
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
          <section className="card p-7 sm:p-10">
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
                  {practiceListItems.length ? (
                    practiceListItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActivePracticeId(normalizeId_(item.id))}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          normalizeId_(activePracticeId) === normalizeId_(item.id)
                            ? "border-slate-900 bg-white text-slate-700"
                            : "border-slate-200/70 bg-slate-50/60 text-slate-700 hover:border-slate-300"
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
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">開始時間</label>
                    <input
                      type="time"
                      value={practiceForm.startAt}
                      onChange={(event) => handlePracticeFormChange("startAt", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">結束時間</label>
                    <input
                      type="time"
                      value={practiceForm.endAt}
                      onChange={(event) => handlePracticeFormChange("endAt", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">球場</label>
                  <select
                    value={practiceForm.fieldId}
                    onChange={(event) => handlePracticeFormChange("fieldId", event.target.value)}
                    className="input-sm"
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
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">練習重點</label>
                  <input
                    value={practiceForm.focus}
                    onChange={(event) => handlePracticeFormChange("focus", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">練習日誌</label>
                  <textarea
                    value={practiceForm.logSummary}
                    onChange={(event) => handlePracticeFormChange("logSummary", event.target.value)}
                    rows="3"
                    className="input-base"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">下次計畫</label>
                  <textarea
                    value={practiceForm.nextPlan}
                    onChange={(event) => handlePracticeFormChange("nextPlan", event.target.value)}
                    rows="2"
                    className="input-base"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">狀態</label>
                    <select
                      value={practiceForm.status}
                      onChange={(event) => handlePracticeFormChange("status", event.target.value)}
                      className="input-sm"
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
                      className="input-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? "儲存中..." : practiceForm.id ? "更新練習" : "新增練習"}
                  </button>
                  {practiceForm.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeletePractice(practiceForm.id)}
                      className="badge-error hover:border-rose-300"
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
          <section className="card p-7 sm:p-10">
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
                className="input-sm"
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
                  const matchedStudent = studentById[normalizeId_(player.id)] || null;
                  const displayName = getPlayerDisplayName_(player, matchedStudent) || "-";
                  const aliasName = getResolvedPlayerAlias_(player, matchedStudent);
                  const chineseName = getResolvedPlayerChineseName_(player, matchedStudent);
                  const record = attendanceByStudent[normalizeId_(player.id)] || {};
                  const currentStatus = String(record.status || "unknown").toLowerCase();
                  return (
                    <div
                      key={player.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {displayName}
                          {aliasName && aliasName !== chineseName ? ` · ${aliasName}` : ""}
                          {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}
                          {player.jerseySize ? ` · ${player.jerseySize}` : ""}
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
          <section className="card p-7 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-900">球員管理</h3>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={playerQuery}
                  onChange={(event) => setPlayerQuery(event.target.value)}
                  placeholder="搜尋姓名、學號、背號、尺寸、暱稱"
                  className="h-10 w-56 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleExportJerseyInfo}
                  className="btn-chip"
                >
                  匯出球衣 CSV
                </button>
              </div>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3">
                {pendingRequests.length ? (
                  <div className="alert alert-warning text-xs p-4">
                    <p className="font-semibold text-amber-900">待審核申請</p>
                    <div className="mt-2 space-y-2">
                      {pendingRequests.map((player) => {
                        const matchedStudent = studentById[normalizeId_(player.id)] || null;
                        const displayName = getPlayerDisplayName_(player, matchedStudent) || "-";
                        const aliasName = getResolvedPlayerAlias_(player, matchedStudent);
                        const chineseName = getResolvedPlayerChineseName_(player, matchedStudent);
                        return (
                          <div
                            key={`pending-${player.id}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/70 bg-white px-3 py-2"
                          >
                            <span className="font-semibold text-slate-800">
                              {displayName}
                              {aliasName && aliasName !== chineseName ? ` · ${aliasName}` : ""}
                              {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}
                              {player.jerseySize ? ` · ${player.jerseySize}` : ""}
                            </span>
                            <span className="text-amber-700">
                              背號：{player.jerseyRequest || "-"} · 位置：
                              {player.positionRequest || "-"}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleReviewRequest(player, "approved")}
                                className="badge-success hover:border-emerald-300"
                              >
                                核准
                              </button>
                              <button
                                onClick={() => handleReviewRequest(player, "rejected")}
                                className="badge-error hover:border-rose-300"
                              >
                                退回
                              </button>
                            </div>
                          </div>
                        );
                      })}
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
                {filteredPlayers.map((player) => {
                  const matchedStudent = studentById[normalizeId_(player.id)] || null;
                  const displayName = getPlayerDisplayName_(player, matchedStudent) || "-";
                  const aliasName = getResolvedPlayerAlias_(player, matchedStudent);
                  const chineseName = getResolvedPlayerChineseName_(player, matchedStudent);
                  return (
                    <div
                      key={player.id}
                      className={`rounded-2xl border p-4 text-sm ${
                        normalizeId_(playerForm.id) === normalizeId_(player.id)
                          ? "border-slate-900 bg-white text-slate-700"
                          : "border-slate-200/70 bg-slate-50/60 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setPlayerForm({
                              ...player,
                              jerseyChoices: player.jerseyChoices || "",
                              jerseySize: player.jerseySize || "",
                              requestStatus: player.requestStatus || "",
                              jerseyRequest: player.jerseyRequest || "",
                              positionRequest: player.positionRequest || "",
                              phone: normalizePhoneInputValue_(player.phone),
                            })
                          }
                          className="flex-1 text-left"
                        >
                          <p className="font-semibold text-slate-900">
                            {displayName}
                            {aliasName && aliasName !== chineseName ? ` · ${aliasName}` : ""}
                            {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}
                            {player.jerseySize ? ` · ${player.jerseySize}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            {player.positions || "-"} · {player.role || "球員"}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="badge-error hover:border-rose-300"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={handleSavePlayer} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">中文姓名</label>
                    <input
                      value={playerForm.name}
                      onChange={(event) => handlePlayerFormChange("name", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">球員暱稱</label>
                    <input
                      value={playerForm.nickname}
                      onChange={(event) => handlePlayerFormChange("nickname", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">聯絡電話</label>
                    <input
                      value={playerForm.phone}
                      onChange={(event) => handlePlayerFormChange("phone", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">背號</label>
                    <input
                      value={playerForm.jerseyNumber}
                      onChange={(event) => handlePlayerFormChange("jerseyNumber", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">球衣尺寸</label>
                    <select
                      value={playerForm.jerseySize}
                      onChange={(event) => handlePlayerFormChange("jerseySize", event.target.value)}
                      className="input-sm"
                    >
                      <option value="">未設定</option>
                      {JERSEY_SIZE_OPTIONS.map((size) => (
                        <option key={`admin-jersey-size-${size}`} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
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
                      value={playerForm.throws}
                      onChange={(event) => handlePlayerFormChange("throws", event.target.value)}
                      className="input-sm"
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
                      className="input-sm"
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
                      className="input-sm"
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
                    className="btn-primary"
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
            <div className="mt-8 rounded-2xl border border-slate-200/70 bg-white p-5 text-sm text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">登錄狀況</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    已登錄 {registeredStudents.length} / {students.length}
                  </p>
                </div>
              </div>
              {!students.length ? (
                <p className="mt-4 text-sm text-slate-500">
                  {studentsLoading ? "同學名單載入中..." : "尚未載入同學名單。"}
                </p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="alert alert-success p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                      <span>已登錄</span>
                      <span>{registeredStudents.length} 人</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {registeredStudents.length ? (
                        registeredStudents.map((student) => (
                          <span
                            key={student.id || student.email}
                            className="badge-success-light"
                          >
                            {getStudentDisplayName_(student) || student.id || "未命名"}
                          </span>
                        ))
                      ) : (
                        <p className="text-xs text-emerald-700">尚無已登錄名單。</p>
                      )}
                    </div>
                  </div>
                  <div className="alert alert-warning p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
                      <span>未登錄</span>
                      <span>{unregisteredStudents.length} 人</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {unregisteredStudents.length ? (
                        unregisteredStudents.map((student) => (
                          <span
                            key={student.id || student.email}
                            className="badge-warning-light"
                          >
                            {getStudentDisplayName_(student) || student.id || "未命名"}
                          </span>
                        ))
                      ) : (
                        <p className="text-xs text-amber-700">全部同學已登錄。</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "fields" ? (
          <section className="card p-7 sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                {fields.map((item) => {
                  const isActive = fieldForm.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setFieldForm({ ...item })}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm text-slate-600 transition ${
                        isActive
                          ? "border-slate-900 bg-white text-slate-700"
                          : "border-slate-200/70 bg-slate-50/60 hover:border-slate-300"
                      } cursor-pointer`}
                    >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.address || "-"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteField(item.id);
                        }}
                        className="badge-error hover:border-rose-300"
                      >
                        刪除
                      </button>
                    </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={handleSaveField} className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">球場名稱</label>
                  <input
                    value={fieldForm.name}
                    onChange={(event) => handleFieldFormChange("name", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">地址</label>
                  <input
                    value={fieldForm.address}
                    onChange={(event) => handleFieldFormChange("address", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">地圖連結</label>
                  <input
                    value={fieldForm.mapUrl}
                    onChange={(event) => handleFieldFormChange("mapUrl", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">停車</label>
                    <input
                      value={fieldForm.parking}
                      onChange={(event) => handleFieldFormChange("parking", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">費用</label>
                    <input
                      value={fieldForm.fee}
                      onChange={(event) => handleFieldFormChange("fee", event.target.value)}
                      className="input-sm"
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
                    className="btn-primary"
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
          <section className="card p-7 sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                {gear.map((item) => {
                  const isActive = gearForm.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setGearForm({ ...item })}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm text-slate-600 transition ${
                        isActive
                          ? "border-slate-900 bg-white text-slate-700"
                          : "border-slate-200/70 bg-slate-50/60 hover:border-slate-300"
                      } cursor-pointer`}
                    >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.category || "-"} · {item.quantity || "0"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteGear(item.id);
                        }}
                        className="badge-error hover:border-rose-300"
                      >
                        刪除
                      </button>
                    </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={handleSaveGear} className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">器材名稱</label>
                  <input
                    value={gearForm.name}
                    onChange={(event) => handleGearFormChange("name", event.target.value)}
                    className="input-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">分類</label>
                    <input
                      value={gearForm.category}
                      onChange={(event) => handleGearFormChange("category", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">數量</label>
                    <input
                      value={gearForm.quantity}
                      onChange={(event) => handleGearFormChange("quantity", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">保管人</label>
                    <input
                      value={gearForm.owner}
                      onChange={(event) => handleGearFormChange("owner", event.target.value)}
                      className="input-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">狀態</label>
                    <select
                      value={gearForm.status}
                      onChange={(event) => handleGearFormChange("status", event.target.value)}
                      className="input-sm"
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
                    className="btn-primary"
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

        {activeTab === "supply" ? (
          <section className="card p-7 sm:p-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">天使補給管理</h2>
                <p className="mt-1 text-sm text-slate-600">管理天使名單、常用補給店家，以及每場練習的補給案件。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "cases", label: "補給案件" },
                  { id: "angels", label: "天使名單" },
                  { id: "vendors", label: "店家" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSupplySubtab(item.id)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                      supplySubtab === item.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {supplySubtab === "cases" ? (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-3">
                  {practiceListItems.length ? (
                    practiceListItems.map((practice) => {
                      const practiceId = normalizeId_(practice.id);
                      const caseItem = supplyCaseByPracticeId[practiceId] || null;
                      const selected = normalizeId_(supplyCaseForm.practiceId) === practiceId;
                      const angelStudentId = caseItem
                        ? normalizeId_(caseItem.angelStudentId || (angelById[normalizeId_(caseItem.angelRosterId)] || {}).studentId)
                        : "";
                      const angelName = angelStudentId ? getPersonDisplayName_(angelStudentId) : "未指定";
                      const vendorIds = caseItem && Array.isArray(caseItem.vendorIds) && caseItem.vendorIds.length
                        ? caseItem.vendorIds
                        : caseItem && caseItem.vendorId
                        ? [caseItem.vendorId]
                        : [];
                      const vendorNames = vendorIds
                        .map((vendorId) => (supplyVendorById[normalizeId_(vendorId)] || {}).name || "")
                        .filter(Boolean);
                      return (
                        <button
                          key={practiceId}
                          type="button"
                          onClick={() => selectSupplyPractice_(practiceId)}
                          className={`w-full rounded-2xl border p-4 text-left text-sm transition ${
                            selected
                              ? "border-slate-900 bg-white text-slate-700"
                              : "border-slate-200/70 bg-slate-50/60 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{practice.title || "練習"}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatPracticeDate_(practice.date || practice.startAt)}
                                {getPracticeListTimeLabel_(practice) ? ` · ${getPracticeListTimeLabel_(practice)}` : ""}
                              </p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${caseItem ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              {caseItem ? (caseItem.orderStatus || "planning") : "尚未建立"}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">天使：{angelName}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">店家：{vendorNames.length ? vendorNames.join(" / ") : "未選擇"}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">人數：{caseItem && caseItem.plannedHeadcount ? caseItem.plannedHeadcount : "-"}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">尚無練習資料。</p>
                  )}
                </div>

                <form onSubmit={handleSaveSupplyCase} className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">對應練習</label>
                    <select
                      value={supplyCaseForm.practiceId}
                      onChange={(event) => selectSupplyPractice_(event.target.value)}
                      className="input-sm"
                    >
                      <option value="">請選擇練習</option>
                      {practiceListItems.map((practice) => (
                        <option key={`supply-practice-${practice.id}`} value={practice.id}>
                          {formatPracticeDate_(practice.date || practice.startAt)} · {practice.title || practice.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">天使同學</label>
                      <select
                        value={supplyCaseForm.angelRosterId}
                        onChange={(event) => {
                          const angel = angelById[normalizeId_(event.target.value)] || null;
                          setSupplyCaseForm((prev) => ({
                            ...prev,
                            angelRosterId: event.target.value,
                            angelStudentId: angel ? angel.studentId || "" : "",
                            angelStatus: event.target.value ? (prev.angelStatus === "unassigned" ? "assigned" : prev.angelStatus) : "unassigned",
                          }));
                        }}
                        className="input-sm"
                      >
                        <option value="">未指定</option>
                        {activeAngelOptions.map((item) => (
                          <option key={`angel-option-${item.id}`} value={item.id}>
                            {getPersonDisplayName_(item.studentId)} · {item.status || "active"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">天使狀態</label>
                      <select
                        value={supplyCaseForm.angelStatus}
                        onChange={(event) => handleSupplyCaseFormChange("angelStatus", event.target.value)}
                        className="input-sm"
                      >
                        <option value="unassigned">未指定</option>
                        <option value="assigned">已指定</option>
                        <option value="confirmed">已確認</option>
                        <option value="done">已完成</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">補給狀態</label>
                      <select
                        value={supplyCaseForm.orderStatus}
                        onChange={(event) => handleSupplyCaseFormChange("orderStatus", event.target.value)}
                        className="input-sm"
                      >
                        <option value="not_started">未開始</option>
                        <option value="planning">規劃中</option>
                        <option value="ordered">已採買 / 已訂</option>
                        <option value="delivered">已送達</option>
                        <option value="closed">已結案</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[0, 1, 2].map((index) => (
                      <div key={`supply-vendor-slot-${index}`} className="grid gap-2">
                        <label className="text-sm font-medium text-slate-700">店家 {index + 1}</label>
                        <select
                          value={(supplyCaseForm.vendorIds && supplyCaseForm.vendorIds[index]) || ""}
                          onChange={(event) => handleSupplyVendorSlotChange(index, event.target.value)}
                          className="input-sm"
                        >
                          <option value="">未選擇</option>
                          {sortedSupplyVendors.map((vendor) => (
                            <option key={`vendor-option-${index}-${vendor.id}`} value={vendor.id}>
                              {vendor.name} {vendor.category ? `· ${vendor.category}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">預估人數</label>
                      <input
                        value={supplyCaseForm.plannedHeadcount}
                        onChange={(event) => handleSupplyCaseFormChange("plannedHeadcount", event.target.value)}
                        className="input-sm"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">總金額</label>
                      <input
                        value={supplyCaseForm.totalAmount}
                        onChange={(event) => handleSupplyCaseFormChange("totalAmount", event.target.value)}
                        className="input-sm"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">下單 / 採買時間</label>
                      <input
                        type="datetime-local"
                        value={supplyCaseForm.orderedAt}
                        onChange={(event) => handleSupplyCaseFormChange("orderedAt", event.target.value)}
                        className="input-sm"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-slate-700">補給明細</label>
                      <button
                        type="button"
                        onClick={addSupplyItem}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        新增明細
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(supplyCaseForm.items && supplyCaseForm.items.length ? supplyCaseForm.items : [buildEmptySupplyItem_()]).map((item) => (
                        <div key={item.localId} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                            <select
                              value={item.type}
                              onChange={(event) => handleSupplyItemChange(item.localId, "type", event.target.value)}
                              className="input-sm"
                            >
                              {SUPPLY_ITEM_TYPE_OPTIONS.map((option) => (
                                <option key={`${item.localId}-type-${option}`} value={option}>{option}</option>
                              ))}
                            </select>
                            <input
                              value={item.name}
                              onChange={(event) => handleSupplyItemChange(item.localId, "name", event.target.value)}
                              placeholder="品項"
                              className="input-sm lg:col-span-2"
                            />
                            <input
                              value={item.qty}
                              onChange={(event) => handleSupplyItemChange(item.localId, "qty", event.target.value)}
                              placeholder="數量"
                              className="input-sm"
                            />
                            <select
                              value={item.unit}
                              onChange={(event) => handleSupplyItemChange(item.localId, "unit", event.target.value)}
                              className="input-sm"
                            >
                              {SUPPLY_ITEM_UNIT_OPTIONS.map((option) => (
                                <option key={`${item.localId}-unit-${option}`} value={option}>{option}</option>
                              ))}
                            </select>
                            <input
                              value={item.amount}
                              onChange={(event) => handleSupplyItemChange(item.localId, "amount", event.target.value)}
                              placeholder="金額"
                              className="input-sm"
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <input
                              value={item.notes}
                              onChange={(event) => handleSupplyItemChange(item.localId, "notes", event.target.value)}
                              placeholder="備註（例如：練習中場吃、冰飲、少糖）"
                              className="input-sm flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => removeSupplyItem(item.localId)}
                              className="badge-error hover:border-rose-300"
                            >
                              移除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">備註</label>
                    <textarea
                      value={supplyCaseForm.notes}
                      onChange={(event) => handleSupplyCaseFormChange("notes", event.target.value)}
                      rows="3"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={saving} className="btn-primary">
                      {saving ? "儲存中..." : "儲存補給案件"}
                    </button>
                    <button
                      type="button"
                      onClick={() => resetSupplyCaseForm(supplyCaseForm.practiceId)}
                      className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      清空
                    </button>
                    {supplyCaseForm.id ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteSupplyCase(supplyCaseForm.id)}
                        className="badge-error hover:border-rose-300"
                      >
                        刪除案件
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            ) : null}

            {supplySubtab === "angels" ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="space-y-3">
                  {sortedAngelRoster.length ? (
                    sortedAngelRoster.map((item) => {
                      const stats = angelStatsByStudentId[normalizeId_(item.studentId)] || { count: 0, lastPracticeLabel: "" };
                      const displayName = getPersonDisplayName_(item.studentId);
                      const selected = normalizeId_(angelForm.id) === normalizeId_(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => setAngelForm({
                            id: item.id || "",
                            studentId: item.studentId || "",
                            status: item.status || "active",
                            joinedAt: item.joinedAt || "",
                            notes: item.notes || "",
                          })}
                          className={`cursor-pointer rounded-2xl border p-4 text-sm ${
                            selected ? "border-slate-900 bg-white text-slate-700" : "border-slate-200/70 bg-slate-50/60 text-slate-600"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{displayName}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.studentId || "-"}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              item.status === "active" ? "bg-emerald-100 text-emerald-700" : item.status === "paused" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                            }`}>{item.status || "active"}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">已輪到 {stats.count} 次</span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">上次：{stats.lastPracticeLabel || "尚未輪到"}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">目前尚無天使名單。</p>
                  )}
                </div>
                <form onSubmit={handleSaveAngel} className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">同學</label>
                    <select
                      value={angelForm.studentId}
                      onChange={(event) => handleAngelFormChange("studentId", event.target.value)}
                      disabled={Boolean(angelForm.id)}
                      className="input-sm"
                    >
                      <option value="">請選擇同學</option>
                      {students
                        .slice()
                        .sort((a, b) => getPersonDisplayName_(a.id).localeCompare(getPersonDisplayName_(b.id), "zh-Hant", { numeric: true, sensitivity: "base" }))
                        .map((student) => (
                          <option key={`angel-student-${student.id}`} value={student.id}>
                            {getPersonDisplayName_(student.id)} · {student.id}
                          </option>
                        ))}
                    </select>
                    {angelForm.id ? <p className="text-[11px] text-slate-400">已存在的天使名單成員不提供直接換人，避免覆蓋到別人的輪值歷史。</p> : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">狀態</label>
                      <select value={angelForm.status} onChange={(event) => handleAngelFormChange("status", event.target.value)} className="input-sm">
                        <option value="active">啟用中</option>
                        <option value="paused">暫停</option>
                        <option value="retired">退出</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">加入日期</label>
                      <input type="date" value={angelForm.joinedAt} onChange={(event) => handleAngelFormChange("joinedAt", event.target.value)} className="input-sm" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">備註</label>
                    <textarea value={angelForm.notes} onChange={(event) => handleAngelFormChange("notes", event.target.value)} rows="3" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={saving} className="btn-primary">{saving ? "儲存中..." : "儲存天使名單"}</button>
                    <button type="button" onClick={resetAngelForm} className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300">清空</button>
                    {angelForm.id ? <button type="button" onClick={() => handleDeleteAngel(angelForm.id)} className="badge-error hover:border-rose-300">移出名單</button> : null}
                  </div>
                </form>
              </div>
            ) : null}

            {supplySubtab === "vendors" ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="space-y-3">
                  {sortedSupplyVendors.length ? (
                    sortedSupplyVendors.map((item) => {
                      const selected = normalizeId_(vendorForm.id) === normalizeId_(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => setVendorForm({
                            id: item.id || "",
                            name: item.name || "",
                            category: item.category || "",
                            phone: item.phone || "",
                            contact: item.contact || "",
                            deliveryNote: item.deliveryNote || "",
                            minOrderAmount: item.minOrderAmount != null ? String(item.minOrderAmount) : "",
                            status: item.status || "active",
                            notes: item.notes || "",
                          })}
                          className={`cursor-pointer rounded-2xl border p-4 text-sm ${
                            selected ? "border-slate-900 bg-white text-slate-700" : "border-slate-200/70 bg-slate-50/60 text-slate-600"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{item.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.category || "-"} · {item.phone || item.contact || "無聯絡方式"}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              item.status === "favorite" ? "bg-emerald-100 text-emerald-700" : item.status === "paused" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                            }`}>{item.status || "active"}</span>
                          </div>
                          <p className="mt-3 text-xs text-slate-500">{item.deliveryNote || item.notes || "尚未填寫備註"}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">目前尚無店家資料。</p>
                  )}
                </div>
                <form onSubmit={handleSaveVendor} className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">店家名稱</label>
                    <input value={vendorForm.name} onChange={(event) => handleVendorFormChange("name", event.target.value)} className="input-sm" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">分類</label>
                      <select value={vendorForm.category} onChange={(event) => handleVendorFormChange("category", event.target.value)} className="input-sm">
                        <option value="">未分類</option>
                        <option value="飲料">飲料</option>
                        <option value="點心">點心</option>
                        <option value="水果">水果</option>
                        <option value="輕食">輕食</option>
                        <option value="綜合補給">綜合補給</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">狀態</label>
                      <select value={vendorForm.status} onChange={(event) => handleVendorFormChange("status", event.target.value)} className="input-sm">
                        <option value="active">可用</option>
                        <option value="favorite">常用</option>
                        <option value="paused">暫停</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">電話</label>
                      <input value={vendorForm.phone} onChange={(event) => handleVendorFormChange("phone", event.target.value)} className="input-sm" />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">聯絡方式</label>
                      <input value={vendorForm.contact} onChange={(event) => handleVendorFormChange("contact", event.target.value)} placeholder="Line / 訂購網址 / 聯絡人" className="input-sm" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">最低金額</label>
                      <input value={vendorForm.minOrderAmount} onChange={(event) => handleVendorFormChange("minOrderAmount", event.target.value)} className="input-sm" />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-slate-700">外送 / 備註摘要</label>
                      <input value={vendorForm.deliveryNote} onChange={(event) => handleVendorFormChange("deliveryNote", event.target.value)} placeholder="例如：可送到球場、晚間可外送" className="input-sm" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">補充備註</label>
                    <textarea value={vendorForm.notes} onChange={(event) => handleVendorFormChange("notes", event.target.value)} rows="3" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={saving} className="btn-primary">{saving ? "儲存中..." : "儲存店家"}</button>
                    <button type="button" onClick={resetVendorForm} className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300">清空</button>
                    {vendorForm.id ? <button type="button" onClick={() => handleDeleteVendor(vendorForm.id)} className="badge-error hover:border-rose-300">刪除店家</button> : null}
                  </div>
                </form>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "stats" ? (
          <section className="card p-7 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">出席統計</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statsScope}
                  onChange={(event) => setStatsScope(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="recent5">最近 5 場</option>
                  <option value="recent10">最近 10 場</option>
                  <option value="all">全部場次</option>
                </select>
                <button
                  type="button"
                  onClick={loadStatsAttendance}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                >
                  {statsLoading ? "更新中…" : "重新整理"}
                </button>
              </div>
            </div>

            {statsError ? <div className="mt-4 alert alert-error">{statsError}</div> : null}
            {statsLoading ? (
              <p className="mt-4 text-xs text-slate-500">統計載入中…</p>
            ) : null}

            {(() => {
              const normalizeAttendanceStatus_ = (value) => {
                const raw = String(value || "").trim().toLowerCase();
                if (raw === "attend" || raw === "late" || raw === "absent" || raw === "unknown") {
                  return raw;
                }
                return "unknown";
              };

              const activePlayersForStats = players.filter((player) => {
                const status = String(player.status || "active").trim().toLowerCase();
                const requestStatus = String(player.requestStatus || "").trim().toLowerCase();
                if (status && status !== "active") {
                  return false;
                }
                if (requestStatus === "pending") {
                  return false;
                }
                return true;
              });

              const practicesSorted = practices
                .slice()
                .sort((a, b) => getPracticeSortKey_(b) - getPracticeSortKey_(a));

              const scopedPractices = (() => {
                if (statsScope === "recent5") {
                  return practicesSorted.slice(0, 5);
                }
                if (statsScope === "all") {
                  return practicesSorted;
                }
                return practicesSorted.slice(0, 10);
              })();

              const pastPractices = scopedPractices.filter((practice) => isPracticeExpired_(practice));

              const attMap = new Map();
              statsAttendance.forEach((item) => {
                const practiceId = normalizeId_(item.practiceId || item.practice_id);
                const playerId = normalizeId_(item.playerId || item.player_id || item.studentId || item.student_id);
                if (!practiceId || !playerId) {
                  return;
                }
                attMap.set(`${practiceId}:${playerId}`, item);
              });

              const practiceStats = scopedPractices.map((practice) => {
                const practiceId = normalizeId_(practice.id);
                const counts = { total: 0, attend: 0, late: 0, absent: 0, unknown: 0 };

                for (const player of activePlayersForStats) {
                  const playerId = normalizeId_(player.id);
                  if (!playerId) {
                    continue;
                  }
                  counts.total += 1;
                  const record = attMap.get(`${practiceId}:${playerId}`);
                  const status = normalizeAttendanceStatus_(record && record.status);
                  counts[status] += 1;
                }

                const responded = counts.total - counts.unknown;
                const present = counts.attend + counts.late;
                const responseRate = counts.total ? Math.round((responded / counts.total) * 100) : 0;
                const participationRate = counts.total ? Math.round((present / counts.total) * 100) : 0;

                return {
                  id: practiceId,
                  title: practice.title || "練習",
                  dateLabel: formatPracticeDate_(practice.date || practice.startAt),
                  counts,
                  responded,
                  present,
                  responseRate,
                  participationRate,
                };
              });

              const playerStats = activePlayersForStats
                .map((player) => {
                  const playerId = normalizeId_(player.id);
                  const counts = { total: pastPractices.length, attend: 0, late: 0, absent: 0, unknown: 0 };

                  for (const practice of pastPractices) {
                    const practiceId = normalizeId_(practice.id);
                    const record = attMap.get(`${practiceId}:${playerId}`);
                    const status = normalizeAttendanceStatus_(record && record.status);
                    counts[status] += 1;
                  }

                  const present = counts.attend + counts.late;
                  const responseRate = counts.total ? Math.round(((counts.total - counts.unknown) / counts.total) * 100) : 0;
                  const participationRate = counts.total ? Math.round((present / counts.total) * 100) : 0;

                  return {
                    id: playerId,
                    name: getPlayerDisplayName_(player) || playerId,
                    counts,
                    present,
                    responseRate,
                    participationRate,
                  };
                })
                .sort((a, b) => b.present - a.present || b.participationRate - a.participationRate || a.name.localeCompare(b.name));

              const totals = practiceStats.reduce(
                (acc, item) => {
                  acc.totalPlayers = item.counts.total;
                  acc.totalPractices += 1;
                  acc.totalUnknown += item.counts.unknown;
                  acc.totalPresent += item.present;
                  return acc;
                },
                { totalPlayers: activePlayersForStats.length, totalPractices: 0, totalUnknown: 0, totalPresent: 0 }
              );

              const nextPracticeId = normalizeId_(nextPractice && nextPractice.id);
              const nextPracticeLabel = nextPractice
                ? `${formatPracticeDate_(nextPractice.date || nextPractice.startAt)} · ${nextPractice.title || "練習"}`
                : "";
              const nextUnknownNames = [];
              const nextAbsentNames = [];
              if (nextPracticeId) {
                for (const player of activePlayersForStats) {
                  const playerId = normalizeId_(player.id);
                  if (!playerId) {
                    continue;
                  }
                  const record = attMap.get(`${nextPracticeId}:${playerId}`);
                  const status = normalizeAttendanceStatus_(record && record.status);
                  const matchedStudent = studentById[playerId] || null;
                  const displayName = getPlayerDisplayName_(player, matchedStudent) || playerId;

                  if (status === "absent") {
                    nextAbsentNames.push(displayName);
                  } else if (status === "unknown") {
                    nextUnknownNames.push(displayName);
                  }
                }
              }

              const buildMentionList_ = (names) =>
                (Array.isArray(names) ? names : []).map((name) => `@${String(name || "").trim()}`).filter((name) => name.length > 1).join(" ");

              const nextUnknownMentions = buildMentionList_(nextUnknownNames);
              const nextAbsentMentions = buildMentionList_(nextAbsentNames);
              const siteRoot = String(
                PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "") || ""
              ).replace(/\/$/, "");
              const playerLink = siteRoot ? `${siteRoot}/softball/player` : "/softball/player";
              const nextReminderText = nextPractice
                ? `【壘球練習回覆提醒】${nextPracticeLabel}\n未回覆：${nextUnknownMentions || "（無）"}\n缺席：${nextAbsentMentions || "（無）"}\n請到系統回覆出席狀態：${playerLink}\n（已回覆者可忽略）`
                : "";

              return (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: "統計球員", value: activePlayersForStats.length },
                      { label: "統計場次", value: scopedPractices.length },
                      { label: "已結束場次", value: pastPractices.length },
                      { label: "總出席(含遲到)", value: totals.totalPresent },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs text-slate-400">{item.label}</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">下一次練習 · 催回覆</h4>
                        {nextPractice ? (
                          <p className="mt-1 text-xs text-slate-500">{nextPracticeLabel}</p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-400">尚未安排下一次練習。</p>
                        )}
                      </div>
                      {nextPractice ? (
                        <button
                          type="button"
                          onClick={() => copyTextToClipboard_(nextReminderText, "已複製提醒文案")}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                        >
                          複製提醒文案
                        </button>
                      ) : null}
                    </div>

                    {nextPractice ? (
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">未回覆（{nextUnknownNames.length}）</p>
                            <button
                              type="button"
                              onClick={() => copyTextToClipboard_(nextUnknownMentions, "已複製未回覆名單")}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                            >
                              複製 @名單
                            </button>
                          </div>
                          <p className="mt-2 break-words text-xs text-slate-600">
                            {nextUnknownMentions || "（無）"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">缺席（{nextAbsentNames.length}）</p>
                            <button
                              type="button"
                              onClick={() => copyTextToClipboard_(nextAbsentMentions, "已複製缺席名單")}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                            >
                              複製 @名單
                            </button>
                          </div>
                          <p className="mt-2 break-words text-xs text-slate-600">
                            {nextAbsentMentions || "（無）"}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-900">各次練習報名/出席概況</h4>
                      <p className="text-xs text-slate-500">點「查看」可跳到點名明細。</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {practiceStats.length ? (
                        practiceStats.map((p) => (
                          <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{p.dateLabel} · {p.title}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  回覆率 {p.responseRate}% · 參與率 {p.participationRate}% · 未回覆 {p.counts.unknown}/{p.counts.total}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePracticeId(p.id);
                                  setActiveTab("attendance");
                                }}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                              >
                                查看
                              </button>
                            </div>
                            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                              {[
                                { label: "出席", value: p.counts.attend, tone: "text-emerald-700" },
                                { label: "遲到", value: p.counts.late, tone: "text-amber-700" },
                                { label: "缺席", value: p.counts.absent, tone: "text-rose-700" },
                                { label: "未回覆", value: p.counts.unknown, tone: "text-slate-600" },
                              ].map((item) => (
                                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                                  <p className={`text-[11px] font-semibold ${item.tone}`}>{item.label}</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">尚無練習資料。</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-900">球員參與次數（已結束練習）</h4>
                      <p className="text-xs text-slate-500">以 attend/late 視為參與。</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {playerStats.length ? (
                        playerStats.map((p) => (
                          <div key={p.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                              <p className="text-xs text-slate-500">
                                參與 {p.present}/{p.counts.total} · 參與率 {p.participationRate}% · 未回覆 {p.counts.unknown}
                              </p>
                            </div>
                            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                              {[
                                { label: "出席", value: p.counts.attend },
                                { label: "遲到", value: p.counts.late },
                                { label: "缺席", value: p.counts.absent },
                                { label: "未回覆", value: p.counts.unknown },
                              ].map((item) => (
                                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                                  <p className="text-[11px] text-slate-500">{item.label}</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">尚無球員資料。</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">說明</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                      <li>「各次練習」包含未來排程，可用來看報名/回覆狀況。</li>
                      <li>「球員參與次數」預設只統計已結束練習，避免未來報名干擾參與率。</li>
                    </ul>
                  </div>
                </>
              );
            })()}
          </section>
        ) : null}

        {activeTab === "roles" ? (
          <section className="card p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900">壘球隊角色權限管理</h2>
              <p className="mt-1 text-sm text-slate-600">
                設定球員的 K 組（壘球隊）角色。擁有 manager / lead / deputy 角色者可進入壘球後台。
              </p>
            </div>

            {(() => {
              const roleOptions = [
                { value: "none", label: "無角色", desc: "移除 K 組角色" },
                { value: "manager", label: "球隊經理", desc: "有後台權限" },
                { value: "lead", label: "隊長", desc: "有後台權限" },
                { value: "deputy", label: "副隊長", desc: "有後台權限" },
                { value: "member", label: "一般成員", desc: "無後台權限" },
              ];

              const membershipByPersonId = memberships.reduce((acc, item) => {
                const personId = String(item.personId || "").trim();
                if (personId) {
                  acc[personId] = item;
                }
                return acc;
              }, {});

              const studentByPersonId = students.reduce((acc, student) => {
                const personId = String(student?.id || "").trim();
                if (personId) {
                  acc[personId] = student;
                }
                return acc;
              }, {});

              const playerByPersonId = players.reduce((acc, player) => {
                const personId = String(player?.id || "").trim();
                if (personId) {
                  acc[personId] = player;
                }
                return acc;
              }, {});

              const managedPersonIds = Array.from(
                new Set([
                  ...players.map((player) => String(player?.id || "").trim()),
                  ...memberships.map((item) => String(item?.personId || "").trim()),
                ].filter((personId) => personId))
              );

              const playersWithMembership = managedPersonIds
                .map((personId) => {
                  const player = playerByPersonId[personId] || {};
                  const student = studentByPersonId[personId] || null;
                  const membership = membershipByPersonId[personId] || null;
                  const chineseName = String(
                    player.name ||
                      student?.nameZh ||
                      student?.name ||
                      membership?.personName ||
                      student?.preferredName ||
                      student?.nameEn ||
                      ""
                  ).trim();
                  const playerName = String(
                    player.preferredName ||
                      player.nickname ||
                      player.nameEn ||
                      student?.preferredName ||
                      student?.nameEn ||
                      ""
                  ).trim();
                  const email = String(player.email || student?.email || "").trim();

                  return {
                    ...player,
                    id: personId,
                    student,
                    membership,
                    chineseName,
                    playerName,
                    email,
                    currentRole: membership ? String(membership.roleInGroup || "").trim().toLowerCase() : "none",
                  };
                })
                .sort((a, b) => {
                  const left = String(a.chineseName || a.playerName || a.email || a.id || "");
                  const right = String(b.chineseName || b.playerName || b.email || b.id || "");
                  return left.localeCompare(right, "zh-Hant", { numeric: true, sensitivity: "base" });
                });

              const handleSetRole = async (personId, role) => {
                if (!personId) {
                  return;
                }
                try {
                  setSaving(true);
                  const { result } = await effectiveApiRequest({
                    action: "setSoftballMembershipRole",
                    personId,
                    role,
                  });
                  if (!result.ok) {
                    throw new Error(result.error || "設定失敗");
                  }
                  flashStatusMessage_(role === "none" ? "已移除角色" : "角色設定成功");
                  await loadMemberships();
                } catch (err) {
                  setError(err.message || "角色設定失敗");
                } finally {
                  setSaving(false);
                }
              };

              return (
                <>
                  {!studentsLoaded || !membershipsLoaded ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
                        <span className="font-medium">載入中…</span>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                            <th className="px-4 py-3">中文姓名 / 球員名稱</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">目前角色</th>
                            <th className="px-4 py-3">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playersWithMembership.length ? (
                            playersWithMembership.map((player) => {
                              const personId = String(player.id || "").trim();
                              const chineseName = String(player.chineseName || "").trim();
                              const playerName = String(player.playerName || "").trim();
                              const displayName = chineseName || playerName || player.email || personId;
                              const email = String(player.email || "").trim();
                              const currentRole = player.currentRole;
                              const currentRoleLabel =
                                roleOptions.find((opt) => opt.value === currentRole)?.label || "無角色";

                              return (
                                <tr key={personId} className="border-b border-slate-100 hover:bg-slate-50/40">
                                  <td className="px-4 py-3 text-slate-900">
                                    <div className="font-semibold">{displayName}</div>
                                    {playerName && playerName !== chineseName ? (
                                      <div className="mt-0.5 text-xs text-slate-500">球員名稱：{playerName}</div>
                                    ) : null}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600">{email || "-"}</td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                                        currentRole === "manager" || currentRole === "lead" || currentRole === "deputy"
                                          ? "bg-emerald-100 text-emerald-700"
                                          : currentRole === "member"
                                          ? "bg-slate-100 text-slate-600"
                                          : "bg-slate-50 text-slate-400"
                                      }`}
                                    >
                                      {currentRoleLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={currentRole}
                                      onChange={(e) => {
                                        const newRole = e.target.value;
                                        if (newRole !== currentRole) {
                                          handleSetRole(personId, newRole);
                                        }
                                      }}
                                      disabled={saving}
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 focus:border-slate-400 disabled:opacity-50"
                                    >
                                      {roleOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label} {opt.desc ? `(${opt.desc})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="4" className="px-4 py-8 text-center text-sm text-slate-400">
                                尚無球員資料。
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">說明</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                      <li>
                        <strong>manager（球隊經理）/ lead（隊長）/ deputy（副隊長）</strong>：可進入壘球後台。
                      </li>
                      <li>
                        <strong>member（一般成員）</strong>：K 組成員但無後台權限。
                      </li>
                      <li>
                        <strong>無角色</strong>：不在 K 組群組名單中。
                      </li>
                      <li>球員自己填寫的「職位」（投手、捕手、球隊經理等）不影響後台權限，只作為參考。</li>
                    </ul>
                  </div>
                </>
              );
            })()}
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

export default SoftballPage;
