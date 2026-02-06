import React, { useEffect, useState } from "react";

function RegistrationPage({ shared }) {
  const {
    apiRequest,
    EVENT_ID,
    DEFAULT_EVENT,
    DRINK_FIELD_IDS,
    gatheringFieldConfig,
    meetingFields,
    normalizePhoneInputValue_,
    formatDisplayDate_,
    formatEventSchedule_,
    buildGoogleMapsUrl_,
    getCategoryLabel_,
    loadCachedEventInfo_,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
    hasDrinkSelection_,
    normalizeCustomFieldsForSubmit_,
    mapRegistrationError,
    GoogleSigninPanel,
  } = shared;

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
      return "none";
    }
    try {
      const { result } = await apiRequest({
        action: "getRegistrationBootstrap",
        eventId: eventId,
        email: normalized,
      });
      if (!result.ok || !result.data) {
        setExistingRegistration(null);
        return "none";
      }
      const { registration, student: matchedStudent } = result.data || {};
      if (matchedStudent) {
        setStudent({
          name: matchedStudent.name || "",
          company: matchedStudent.company || "",
          title: matchedStudent.title || "",
          phone: normalizePhoneInputValue_(matchedStudent.phone),
          dietaryPreference: matchedStudent.dietaryPreference || "",
        });
        setCustomFields((prev) =>
          prev.dietary && prev.studentId
            ? prev
            : {
                ...prev,
                dietary: matchedStudent.dietaryPreference || prev.dietary || "無禁忌",
                studentId: matchedStudent.id || prev.studentId || "",
              }
        );
        setAutoFilled(true);
        setLookupStatus("found");
      }
      if (!registration) {
        setExistingRegistration(null);
        return matchedStudent ? "student" : "none";
      }
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
      return "registration";
    } catch (error) {
      setExistingRegistration(null);
      return "none";
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
        const { result } = await apiRequest({ action: "getRegistrationBootstrap", eventId: eventId });
        if (!result.ok || !result.data || !result.data.event) {
          throw new Error(result.error || "Event not found");
        }
        if (!ignore) {
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
    const normalized = String(email || "").trim().toLowerCase();
    setLookupStatus("loading");
    const timer = setTimeout(async () => {
      const status = await loadExistingRegistration(normalized);
      if (ignore) {
        return;
      }
      if (status === "none") {
        setAutoFilled(false);
        setLookupStatus("notfound");
        setStudent({ name: "", company: "", title: "", phone: "", dietaryPreference: "" });
      } else if (status === "student") {
        setLookupStatus("found");
      } else if (status === "registration") {
        setLookupStatus("found");
      }
    }, autoFilled ? 0 : 400);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [email, autoFilled]);

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
            aria-pressed={isActive}
            onClick={() => onChange(option)}
            className={`min-h-[40px] rounded-full border px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 focus-visible:ring-offset-2 ${
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
        inputMode="numeric"
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        className="input-base"
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
              className="hidden btn-ghost sm:inline-flex"
            >
              返回報名列表
            </a>
            {eventLoading ? (
              <span className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm sm:inline-flex">
                活動資料載入中
              </span>
            ) : null}
            <span className="hidden badge-muted sm:inline-flex">
              {eventInfo.status === "open" ? "報名進行中" : "報名狀態更新"} · 名額 {eventInfo.capacity}
            </span>
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 sm:hidden">
          <a
            href="/"
            className="btn-chip px-3 py-1.5"
          >
            返回報名列表
          </a>
          {eventLoading ? (
            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-slate-500 shadow-sm">
              活動資料載入中
            </span>
          ) : null}
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-slate-500 shadow-sm">
            {eventInfo.status === "open" ? "報名進行中" : "報名狀態更新"} · 名額 {eventInfo.capacity}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 pb-28 pt-10 sm:grid-cols-[1.1fr_0.9fr] sm:px-12">
        <section className="card p-7 sm:p-10">
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
              <div className="alert alert-success">
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
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={Boolean(googleLinkedStudent && googleLinkedStudent.email)}
                className="input-base"
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
                  autoComplete="name"
                  onChange={(event) => setStudent({ ...student, name: event.target.value })}
                  disabled={Boolean(student.name)}
                  className="input-base"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                  聯絡資訊
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={student.phone}
                  placeholder="手機或其他聯絡方式"
                  inputMode="tel"
                  autoComplete="tel"
                  onChange={(event) => setStudent({ ...student, phone: event.target.value })}
                  className="input-base"
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
                          className="input-base"
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
                          autoComplete="off"
                          onChange={(event) => handleCustomFieldChange(field.id, event.target.value)}
                          className="input-base"
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
                        inputMode="numeric"
                        min="0"
                        onChange={(event) =>
                          handleCustomFieldChange(
                            gatheringFieldConfig.companions.id,
                            event.target.value
                          )
                        }
                        className="input-base"
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
                      className="input-base"
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
                                autoComplete="off"
                                onChange={(event) =>
                                  handleCustomFieldChange(field.id, event.target.value)
                                }
                                className="input-base"
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
              className="mt-2 w-full input-base"
            />
          </div>

          {submitError ? (
            <div className="mt-8 alert alert-warning">
              <p className="font-semibold">報名未完成</p>
              <p className="mt-1 text-amber-600">{submitError}</p>
              <p className="mt-2 text-xs text-amber-500">若持續無法送出，請聯繫班級承辦。</p>
            </div>
          ) : null}

          {submitSuccess ? (
            <div className="mt-8 alert alert-success">
              <p className="font-semibold">報名成功</p>
              <p className="mt-1 text-emerald-600">已完成報名，期待與你相見。</p>
            </div>
          ) : null}

          <button
            onClick={handleRegister}
            disabled={submitLoading}
            className="mt-10 hidden w-full items-center justify-center gap-2 btn-primary sm:inline-flex"
          >
            {submitLoading ? "送出中..." : "送出報名"}
          </button>
        </section>

        <aside className="space-y-6">
          <div className="card-soft p-6">
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

      <div className="fixed fixed-bottom-cta left-4 right-4 z-20 sm:hidden">
        <button
          onClick={handleRegister}
          disabled={submitLoading}
          className="flex w-full items-center justify-center btn-primary text-base shadow-2xl shadow-slate-900/20"
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

export default RegistrationPage;
