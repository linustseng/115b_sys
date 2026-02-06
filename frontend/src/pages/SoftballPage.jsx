import React, { useEffect, useMemo, useRef, useState } from "react";

function SoftballPage({ shared }) {

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

  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);
  const [practices, setPractices] = useState([]);
  const [fields, setFields] = useState([]);
  const [gear, setGear] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
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

  const getStudentDisplayName_ = (student) =>
    String(
      (student && (student.preferredName || student.nameZh || student.nameEn || student.name)) || ""
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
            loadStudents(),
          ]);
        } finally {
          if (!ignore) {
            setLoading(false);
          }
        }
      } else {
        await loadStudents();
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
                  {practices.length ? (
                    practices.map((item) => (
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
          <section className="card p-7 sm:p-10">
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
                  <div className="alert alert-warning text-xs p-4">
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
                          className="badge-error hover:border-rose-300"
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
                <div className="grid gap-3 sm:grid-cols-2">
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
                <p className="mt-4 text-sm text-slate-500">尚未載入同學名單。</p>
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

        {activeTab === "stats" ? (
          <section className="card p-7 sm:p-10">
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
            <div className="mt-6 card-muted p-5 text-sm text-slate-600">
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

export default SoftballPage;
