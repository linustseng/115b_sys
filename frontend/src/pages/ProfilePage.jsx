import React, { useEffect, useMemo, useState } from "react";

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
    storeGoogleStudent_,
    normalizePhoneInputValue_,
  } = shared;
  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [idToken, setIdToken] = useState("");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(buildEmptyForm_);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
    if (!token) {
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { result } = await apiRequest({
        action: "getDirectoryProfile",
        idToken: token,
      });
      if (!result.ok) {
        throw new Error(result.error || "載入失敗");
      }
      const payload = result.data && result.data.profile ? result.data.profile : null;
      setProfile(payload);
      setForm({
        email: payload && payload.email ? payload.email : "",
        phone: payload && payload.phone ? payload.phone : "",
        company: payload && payload.company ? payload.company : "",
        title: payload && payload.title ? payload.title : "",
        displayName: payload && payload.displayName ? payload.displayName : "",
        backupPhone: payload && payload.backupPhone ? payload.backupPhone : "",
        emergencyContact: payload && payload.emergencyContact ? payload.emergencyContact : "",
        emergencyPhone: payload && payload.emergencyPhone ? payload.emergencyPhone : "",
        birthdayMonth: payload && payload.birthdayMonth ? payload.birthdayMonth : "",
        birthdayDay: payload && payload.birthdayDay ? payload.birthdayDay : "",
      });
    } catch (err) {
      setError(err.message || "載入失敗");
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
    if (!idToken) {
      return;
    }
    loadProfile(idToken);
  }, [idToken]);

  useEffect(() => {
    if (idToken) {
      return;
    }
    let cancelled = false;
    getGoogleIdTokenSilently_()
      .then((token) => {
        if (!cancelled && token) {
          setIdToken(token);
        }
      })
      .catch(() => {
        // Silent login can fail; manual sign-in stays available.
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, getGoogleIdTokenSilently_]);

  const handleLinkedStudent = (student, _profile, token) => {
    setGoogleLinkedStudent(student || null);
    if (student) {
      storeGoogleStudent_(student);
    }
    if (token) {
      setIdToken(token);
    }
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!idToken) {
      setError("請先登入 Google");
      return;
    }
    setSaving(true);
    try {
      const { result } = await apiRequest({
        action: "updateDirectoryProfile",
        idToken: idToken,
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
      });
      if (!result.ok) {
        throw new Error(result.error || "更新失敗");
      }
      const payload = result.data && result.data.profile ? result.data.profile : null;
      setProfile(payload);
      if (payload) {
        setForm({
          email: payload.email || "",
          phone: payload.phone || "",
          company: payload.company || "",
          title: payload.title || "",
          displayName: payload.displayName || "",
          backupPhone: payload.backupPhone || "",
          emergencyContact: payload.emergencyContact || "",
          emergencyPhone: payload.emergencyPhone || "",
          birthdayMonth: payload.birthdayMonth || "",
          birthdayDay: payload.birthdayDay || "",
        });
        updateStoredStudent_({
          email: payload.email || "",
          phone: payload.phone || "",
          company: payload.company || "",
          title: payload.title || "",
          preferredName: payload.displayName || "",
        });
      }
      setSuccess("已更新個人資訊");
    } catch (err) {
      setError(err.message || "更新失敗");
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
              個人資訊維護
            </h1>
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
        <section className="card p-7 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Google 驗證</h2>
            {loading ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                載入中
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
