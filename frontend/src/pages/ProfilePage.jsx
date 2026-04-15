import React, { useEffect, useMemo, useState } from "react";
import { mapAppErrorMessage } from "../utils/errorMappings";
import { shouldRunProfileSilentRecovery } from "../utils/authPageState";

const buildEmptyForm_ = () => ({
  email: "",
  phone: "",
  company: "",
  title: "",
  displayName: "",
  backupPhone: "",
  emergencyContact: "",
  emergencyPhone: "",
  birthdayMonth: "",
  birthdayDay: "",
});

const buildNumberOptions_ = (max) => {
  const items = [];
  for (let index = 1; index <= max; index += 1) {
    items.push(String(index));
  }
  return items;
};

export default function ProfilePage({ shared }) {
  const {
    apiRequest,
    GoogleSigninPanel,
    getGoogleIdTokenSilently_,
    loadStoredGoogleStudent_,
    loadStoredGoogleIdToken_,
    storeGoogleIdToken_,
    storeGoogleStudent_,
    normalizePhoneInputValue_,
  } = shared;
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [idToken, setIdToken] = useState(() => loadStoredGoogleIdToken_());
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(buildEmptyForm_);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authRecovering, setAuthRecovering] = useState(() =>
    Boolean(loadStoredGoogleStudent_() && !loadStoredGoogleIdToken_())
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const monthOptions = useMemo(() => buildNumberOptions_(12), []);
  const dayOptions = useMemo(() => buildNumberOptions_(31), []);

  const displayName = useMemo(() => {
    if (!googleLinkedStudent) {
      return "";
    }
    return (
      googleLinkedStudent.preferredName ||
      googleLinkedStudent.nameZh ||
      googleLinkedStudent.name ||
      ""
    );
  }, [googleLinkedStudent]);

  const loadProfile = async (token) => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const requestPayload = { action: "getDirectoryProfile" };
      if (token) {
        requestPayload.idToken = token;
      }
      const { result } = await apiRequest(requestPayload);
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const profilePayload = result.data && result.data.profile ? result.data.profile : null;
      setProfile(profilePayload);
      setForm({
        email: profilePayload && profilePayload.email ? profilePayload.email : "",
        phone: profilePayload && profilePayload.phone ? profilePayload.phone : "",
        company: profilePayload && profilePayload.company ? profilePayload.company : "",
        title: profilePayload && profilePayload.title ? profilePayload.title : "",
        displayName: profilePayload && profilePayload.displayName ? profilePayload.displayName : "",
        backupPhone: profilePayload && profilePayload.backupPhone ? profilePayload.backupPhone : "",
        emergencyContact: profilePayload && profilePayload.emergencyContact ? profilePayload.emergencyContact : "",
        emergencyPhone: profilePayload && profilePayload.emergencyPhone ? profilePayload.emergencyPhone : "",
        birthdayMonth: profilePayload && profilePayload.birthdayMonth ? profilePayload.birthdayMonth : "",
        birthdayDay: profilePayload && profilePayload.birthdayDay ? profilePayload.birthdayDay : "",
      });
    } catch (err) {
      const message = String((err && err.message) || "載入失敗");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再載入個人資料。",
          networkMessage: "目前網路或系統回應較慢，個人資料稍後再試。",
          fallbackMessage: message,
        })
      );
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const updateStoredStudent_ = (updates) => {
    setGoogleLinkedStudent((prev) => {
      if (!prev) {
        return prev;
      }
      const next = { ...prev, ...updates };
      storeGoogleStudent_(next);
      return next;
    });
  };

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    loadProfile(idToken);
  }, [googleLinkedStudent && googleLinkedStudent.email, idToken]);

  useEffect(() => {
    if (!shouldRunProfileSilentRecovery({ googleLinkedStudent, idToken })) {
      setAuthRecovering(false);
      return;
    }
    let cancelled = false;
    setAuthRecovering(true);
    getGoogleIdTokenSilently_()
      .then((token) => {
        if (!cancelled && token) {
          const normalized = String(token || "").trim();
          setIdToken(normalized);
          storeGoogleIdToken_(normalized);
        }
      })
      .catch(() => {
        // Silent login can fail; session-first auth may still be available.
      })
      .finally(() => {
        if (!cancelled) {
          setAuthRecovering(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, googleLinkedStudent && googleLinkedStudent.email, getGoogleIdTokenSilently_, storeGoogleIdToken_]);

  const handleLinkedStudent = (student, _profile, token) => {
    const normalizedToken = String(token || "").trim();
    setGoogleLinkedStudent(student || null);
    if (student) {
      storeGoogleStudent_(student);
    }
    if (normalizedToken) {
      setIdToken(normalizedToken);
      storeGoogleIdToken_(normalizedToken);
    }
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      setError("請先登入 Google");
      return;
    }
    setSaving(true);
    try {
      const requestPayload = {
        action: "updateDirectoryProfile",
        data: {
          email: form.email,
          phone: normalizePhoneInputValue_(form.phone),
          company: form.company,
          title: form.title,
          displayName: form.displayName,
          backupPhone: normalizePhoneInputValue_(form.backupPhone),
          emergencyContact: form.emergencyContact,
          emergencyPhone: normalizePhoneInputValue_(form.emergencyPhone),
          birthdayMonth: form.birthdayMonth,
          birthdayDay: form.birthdayDay,
        },
      };
      if (idToken) {
        requestPayload.idToken = idToken;
      }
      const { result } = await apiRequest(requestPayload);
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      const profilePayload = result.data && result.data.profile ? result.data.profile : null;
      setProfile(profilePayload);
      if (profilePayload) {
        setForm({
          email: profilePayload.email || "",
          phone: profilePayload.phone || "",
          company: profilePayload.company || "",
          title: profilePayload.title || "",
          displayName: profilePayload.displayName || "",
          backupPhone: profilePayload.backupPhone || "",
          emergencyContact: profilePayload.emergencyContact || "",
          emergencyPhone: profilePayload.emergencyPhone || "",
          birthdayMonth: profilePayload.birthdayMonth || "",
          birthdayDay: profilePayload.birthdayDay || "",
        });
        updateStoredStudent_({
          email: profilePayload.email || "",
          phone: profilePayload.phone || "",
          company: profilePayload.company || "",
          title: profilePayload.title || "",
          preferredName: profilePayload.displayName || "",
        });
      }
      setSuccess("已更新個人資訊");
    } catch (err) {
      const message = String((err && err.message) || "更新失敗");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "登入狀態已失效，請重新登入後再更新個人資料。",
          networkMessage: "目前網路或系統回應較慢，稍後再試一次。",
          fallbackMessage: message,
        })
      );
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              NTU EMBA 115B
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              個人資料 · 同學版
            </h1>
            <div className="mt-4">
              <a
                href="/"
                className="btn-chip sm:px-4 sm:text-xs"
              >
                回首頁
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-xs text-slate-600 shadow-sm">
            {googleLinkedStudent ? (
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

      <main className="mx-auto max-w-4xl px-6 pb-28 pt-8 sm:px-12">
        {!googleLinkedStudent ? (
          <section className="card p-7 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Google 驗證</h2>
            {loading || authRecovering ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {authRecovering ? "恢復登入中" : "載入中"}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            請登入 Google，系統會讀取並更新你的同學名錄資料。
          </p>
          <div className="mt-4">
            <GoogleSigninPanel
              title="Google 登入"
              helperText="完成綁定後即可維護個人資訊。"
              onLinkedStudent={handleLinkedStudent}
            />
          </div>
          </section>
        ) : null}

        <section className="mt-6 card p-7 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">我的資料</h2>
            {profile ? (
              <span className="text-xs text-slate-400">學號 {profile.id || "-"}</span>
            ) : null}
          </div>
          {!profile && !loading ? (
            <p className="mt-4 text-sm text-slate-500">
              登入後會自動帶入目前的個人資訊。
            </p>
          ) : null}
          <form onSubmit={handleSave} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange("email", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">電話</label>
              <input
                value={form.phone}
                onChange={(event) => handleChange("phone", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">顯示名稱</label>
              <input
                value={form.displayName}
                onChange={(event) => handleChange("displayName", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">公司</label>
              <input
                value={form.company}
                onChange={(event) => handleChange("company", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">職稱</label>
              <input
                value={form.title}
                onChange={(event) => handleChange("title", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">備用電話</label>
              <input
                value={form.backupPhone}
                onChange={(event) => handleChange("backupPhone", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">緊急聯絡人</label>
              <input
                value={form.emergencyContact}
                onChange={(event) => handleChange("emergencyContact", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">緊急聯絡人電話</label>
              <input
                value={form.emergencyPhone}
                onChange={(event) => handleChange("emergencyPhone", event.target.value)}
                className="input-sm"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">生日</label>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={form.birthdayMonth}
                  onChange={(event) => handleChange("birthdayMonth", event.target.value)}
                  className="input-sm"
                >
                  <option value="">月</option>
                  {monthOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select
                  value={form.birthdayDay}
                  onChange={(event) => handleChange("birthdayDay", event.target.value)}
                  className="input-sm"
                >
                  <option value="">日</option>
                  {dayOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? (
              <div className="sm:col-span-2 alert alert-error">{error}</div>
            ) : null}
            {success ? (
              <div className="sm:col-span-2 alert alert-success">{success}</div>
            ) : null}
            <button
              type="submit"
              disabled={saving || loading}
              className="sm:col-span-2 rounded-2xl bg-[#1e293b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "更新中..." : "更新資料"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
