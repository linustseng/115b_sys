import React, { useEffect, useState } from "react";
import { parseDirectoryImport_ } from "../adminUtils";

export default function DirectoryPage({ apiRequest }) {
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
