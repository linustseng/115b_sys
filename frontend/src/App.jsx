import React, { useEffect, useState } from "react";
import { getCheckinErrorDisplay, mapRegistrationError } from "./utils/errorMappings";

const gatheringFields = [
  {
    id: "attendance",
    label: "是否出席",
    type: "select",
    options: ["出席", "不出席", "尚未確定"],
  },
  {
    id: "companions",
    label: "攜伴人數",
    type: "number",
    placeholder: "0",
  },
  {
    id: "dietary",
    label: "飲食偏好",
    type: "select",
    options: ["無", "素食", "不吃牛", "不吃豬", "清真"],
  },
  {
    id: "seating",
    label: "座位/同桌需求",
    type: "text",
    placeholder: "可填想同桌的同學姓名",
  },
  {
    id: "parking",
    label: "是否需要停車位",
    type: "select",
    options: ["需要", "不需要"],
  },
];

const meetingFields = [
  {
    id: "attendance",
    label: "是否出席",
    type: "select",
    options: ["出席", "不出席", "尚未確定"],
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
const EVENT_ID = "EVT-2024-10-18";
const DEFAULT_EVENT = {
  title: "秋季聚餐",
  location: "大直 · 磺溪會館",
  date: "2024/10/18 (五)",
  time: "18:30 - 21:30",
  category: "gathering",
  capacity: 60,
  status: "open",
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
  const [student, setStudent] = useState({
    name: "",
    company: "",
    title: "",
    phone: "",
    dietaryPreference: "",
  });
  const [customFields, setCustomFields] = useState({});
  const [notes, setNotes] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);
  const [lookupStatus, setLookupStatus] = useState("idle");
  const [eventInfo, setEventInfo] = useState(DEFAULT_EVENT);
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
            date: event.startAt || DEFAULT_EVENT.date,
            time: event.endAt ? `${event.startAt || ""} - ${event.endAt}` : DEFAULT_EVENT.time,
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
          email: email.trim().toLowerCase(),
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
            phone: match.phone || "",
            dietaryPreference: match.dietaryPreference || "",
          });
          setCustomFields((prev) =>
            prev.dietary
              ? prev
              : {
                  ...prev,
                  dietary: match.dietaryPreference || prev.dietary || "無",
                }
          );
          setAutoFilled(true);
          setLookupStatus("found");
        }
      } catch (error) {
        if (!ignore) {
          setAutoFilled(false);
          setLookupStatus("notfound");
          setStudent({ name: "", company: "", title: "", phone: "", dietaryPreference: "" });
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

  const handleRegister = async () => {
    setSubmitError("");
    setSubmitSuccess(false);
    if (!email.trim()) {
      setSubmitError("請先輸入 Email 以帶入同學資料。");
      return;
    }
    if (!student.name.trim()) {
      setSubmitError("請確認姓名資料是否正確。");
      return;
    }
    setSubmitLoading(true);
    try {
      const { result } = await apiRequest({
        action: "register",
        data: {
          eventId: eventId,
          slug: slug,
          userEmail: email.trim().toLowerCase(),
          userName: student.name.trim(),
          userPhone: student.phone.trim(),
          customFields: {
            ...customFields,
            notes: notes.trim(),
          },
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "報名失敗");
      }
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(mapRegistrationError(err.message || "報名失敗"));
    } finally {
      setSubmitLoading(false);
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
              {eventInfo.title} 報名
            </h1>
          </div>
          <span className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm sm:inline-flex">
            {eventInfo.status === "open" ? "報名進行中" : "報名狀態更新"} · 名額 {eventInfo.capacity}
          </span>
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
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              />
              <p className="text-xs text-slate-500">
                輸入後將自動帶入姓名與公司等資料。
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
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="company">
                  公司
                </label>
                <input
                  id="company"
                  type="text"
                  value={student.company}
                  placeholder="公司名稱"
                  onChange={(event) => setStudent({ ...student, company: event.target.value })}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="title">
                  職稱
                </label>
                <input
                  id="title"
                  type="text"
                  value={student.title}
                  placeholder="職稱"
                  onChange={(event) => setStudent({ ...student, title: event.target.value })}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                  手機 (選填)
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={student.phone}
                  placeholder="09xx-xxx-xxx"
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
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {(eventInfo.category === "meeting" ? meetingFields : gatheringFields).map((field) => {
                if (field.type === "select") {
                  return (
                    <div key={field.id} className="grid gap-2">
                        <label className="text-sm font-medium text-slate-700" htmlFor={field.id}>
                          {field.label}
                        </label>
                        <select
                          id={field.id}
                          value={customFields[field.id] || ""}
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
                      value={customFields[field.id] || ""}
                      onChange={(event) => handleCustomFieldChange(field.id, event.target.value)}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                    />
                  </div>
                );
              })}
            </div>
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
              <div className="flex items-center justify-between">
                <span>日期</span>
                <span className="font-medium text-slate-800">{eventInfo.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>時間</span>
                <span className="font-medium text-slate-800">{eventInfo.time}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>地點</span>
                <span className="font-medium text-slate-800">{eventInfo.location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>類別</span>
                <span className="font-medium text-slate-800">
                  {eventInfo.category === "meeting" ? "開會" : "聚餐"}
                </span>
              </div>
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
    </div>
  );
}

function CheckinPage() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId") || "";
  const slug = params.get("slug") || "";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const errorDisplay = getCheckinErrorDisplay(error);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("請輸入 Email 以完成簽到。");
      return;
    }
    if (!eventId || !slug) {
      setError("Missing slug");
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
          userEmail: email.trim().toLowerCase(),
        },
      });
      if (!result.ok) {
        throw new Error(result.error || "簽到失敗");
      }
      setName(result.data && result.data.userName ? result.data.userName : "同學");
      setSuccess(true);
    } catch (err) {
      setError(err.message || "簽到失敗");
    } finally {
      setLoading(false);
    }
  };

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
          </div>
          <span className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm sm:inline-flex">
            立即簽到
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-28 pt-10 sm:px-12">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.8)] backdrop-blur sm:p-10">
          <h2 className="text-lg font-semibold text-slate-900">確認簽到</h2>
          <p className="mt-2 text-sm text-slate-500">
            請輸入 Email 以完成簽到。{eventId && `活動：${eventId}`}
          </p>

          <div className="mt-6 grid gap-4">
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
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
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
            disabled={loading}
            className="mt-8 hidden w-full items-center justify-center gap-2 rounded-2xl bg-[#1e293b] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
          >
            {loading ? "簽到中..." : "確認簽到"}
          </button>
        </section>
      </main>

      <div className="fixed bottom-5 left-4 right-4 z-20 sm:hidden">
        <button
          onClick={handleSubmit}
          disabled={loading}
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
            {events.map((event) => {
              const statusLabel = event.status === "open" ? "報名進行中" : "報名狀態更新";
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
                    <p className="mt-2 text-sm text-slate-500">{event.location}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {event.startAt} - {event.endAt}
                    </p>
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
    registrationOpenAt: "",
    registrationCloseAt: "",
    checkinOpenAt: "",
    checkinCloseAt: "",
    capacity: "",
    status: "draft",
    category: "gathering",
  });
  const [studentForm, setStudentForm] = useState({
    id: "",
    name: "",
    email: "",
    studentNo: "",
    phone: "",
    company: "",
    title: "",
    dietaryPreference: "",
    notes: "",
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

  const buildDefaultForm = (items) => {
    const baseDate = addDays_(new Date(), 10);
    const startAt = toLocalInput_(baseDate, 19, 0);
    const endAt = toLocalInput_(baseDate, 21, 0);
    const registrationOpenAt = toLocalInput_(addDays_(baseDate, -14), 9, 0);
    const registrationCloseAt = toLocalInput_(addDays_(baseDate, -2), 23, 0);
    const checkinOpenAt = toLocalInput_(baseDate, 18, 0);
    const checkinCloseAt = toLocalInput_(baseDate, 20, 30);
    const eventId = generateEventId_(baseDate, "gathering", items, seedTimestamp);
    return {
      id: eventId,
      title: "",
      description: "",
      startAt: startAt,
      endAt: endAt,
      location: "",
      registrationOpenAt: registrationOpenAt,
      registrationCloseAt: registrationCloseAt,
      checkinOpenAt: checkinOpenAt,
      checkinCloseAt: checkinCloseAt,
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
      startAt: event.startAt || "",
      endAt: event.endAt || "",
      location: event.location || "",
      registrationOpenAt: event.registrationOpenAt || "",
      registrationCloseAt: event.registrationCloseAt || "",
      checkinOpenAt: event.checkinOpenAt || "",
      checkinCloseAt: event.checkinCloseAt || "",
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
      const action = studentForm.email ? "updateStudent" : "createStudent";
      const { result } = await apiRequest({ action: action, data: studentForm });
      if (!result.ok) {
        throw new Error(result.error || "儲存失敗");
      }
      setStudentForm({
        id: "",
        name: "",
        email: "",
        studentNo: "",
        phone: "",
        company: "",
        title: "",
        dietaryPreference: "",
        notes: "",
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
      email: student.email || "",
      studentNo: student.studentNo || "",
      phone: student.phone || "",
      company: student.company || "",
      title: student.title || "",
      dietaryPreference: student.dietaryPreference || "",
      notes: student.notes || "",
    });
  };

  const handleStudentDelete = async (email) => {
    if (!email) {
      return;
    }
    setSaving(true);
    try {
      const { result } = await apiRequest({ action: "deleteStudent", email: email });
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
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (value) => {
    setForm((prev) => {
      const next = { ...prev, category: value };
      if (!activeId) {
        const fallbackDate = parseLocalInputDate_(prev.startAt) || addDays_(new Date(), 10);
        next.id = generateEventId_(fallbackDate, value, events, seedTimestamp);
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
                  key={item.email}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.email} · {item.company}
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
                      onClick={() => handleStudentDelete(item.email)}
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
                  </div>
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
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  value={studentForm.email}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, email: event.target.value }))}
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
                <label className="text-sm font-medium text-slate-700">公司</label>
                <input
                  value={studentForm.company}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, company: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">職稱</label>
                <input
                  value={studentForm.title}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">手機</label>
                <input
                  value={studentForm.phone}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, phone: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">飲食偏好</label>
                <input
                  value={studentForm.dietaryPreference}
                  onChange={(event) =>
                    setStudentForm((prev) => ({ ...prev, dietaryPreference: event.target.value }))
                  }
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">備註</label>
                <textarea
                  value={studentForm.notes}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows="3"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
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
                      email: "",
                      studentNo: "",
                      phone: "",
                      company: "",
                      title: "",
                      dietaryPreference: "",
                      notes: "",
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
                  <option value="checkin">簽到</option>
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
        email: email.trim().toLowerCase(),
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
            支援欄位：Email、中文姓名、英文姓名、希望大家怎麼叫你、社群網址、行動電話、備用電話、緊急聯絡人姓名/關係/電話。
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
                key={item.email}
                className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.nameZh || "未命名"}</p>
                    <p className="text-xs text-slate-500">{item.email}</p>
                  </div>
                  <div className="text-xs text-slate-500">{item.mobile}</div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <div>英文姓名: {item.nameEn || "-"}</div>
                  <div>稱呼: {item.preferredName || "-"}</div>
                  <div>社群: {item.socialUrl || "-"}</div>
                  <div>備用電話: {item.backupPhone || "-"}</div>
                  <div>緊急聯絡人: {item.emergencyContact || "-"}</div>
                  <div>關係/電話: {item.emergencyRelation || "-"} · {item.emergencyPhone || "-"}</div>
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
    "Email 信箱": "email",
    Email: "email",
    email: "email",
    "中文姓名": "nameZh",
    "英文姓名": "nameEn",
    "希望大家怎麼叫妳/你（非必填）": "preferredName",
    "希望大家怎麼叫你": "preferredName",
    "FB/IG  社群網站網址 (非必填)": "socialUrl",
    "FB/IG 社群網站網址 (非必填)": "socialUrl",
    "FB/IG 社群網站網址": "socialUrl",
    "行動電話": "mobile",
    "備用的連絡電話（公司或住家 ）": "backupPhone",
    "備用的連絡電話（公司或住家）": "backupPhone",
    "緊急聯絡人姓名（與您的關係)": "emergencyContact",
    "緊急聯絡人姓名": "emergencyContact",
    "緊急聯絡人電話": "emergencyPhone",
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
    if (record.emergencyContact && record.emergencyContact.includes("（")) {
      const parts = record.emergencyContact.split("（");
      record.emergencyContact = parts[0];
      record.emergencyRelation = parts[1] ? parts[1].replace("）", "") : "";
    }
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
