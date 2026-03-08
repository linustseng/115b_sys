import React, { useEffect, useMemo, useState } from "react";

export default function DirectoryPage({ shared }) {
  const {
    apiRequest,
    GoogleSigninPanel,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
    getGoogleIdTokenSilently_,
  } = shared;

  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sortKey, setSortKey] = useState("nameZh");
  const [sortDir, setSortDir] = useState("asc");

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

  const getSortValue_ = (item, key) => {
    switch (key) {
      case "birthday":
        return `${String(item.birthdayMonth || "").padStart(2, "0")}${String(item.birthdayDay || "").padStart(2, "0")}`;
      default:
        return String(item && item[key] ? item[key] : "").toLowerCase();
    }
  };

  const filteredDirectory = useMemo(
    () =>
      directory.filter((item) => {
        const groupMatch = groupFilter === "all" ? true : String(item.group || "") === groupFilter;
        return groupMatch && matchesDirectoryQuery_(item, directoryQuery);
      }),
    [directory, directoryQuery, groupFilter]
  );

  const sortedDirectory = useMemo(() => {
    const next = filteredDirectory.slice();
    next.sort((a, b) => {
      const left = getSortValue_(a, sortKey);
      const right = getSortValue_(b, sortKey);
      const cmp = String(left).localeCompare(String(right), "zh-Hant", { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [filteredDirectory, sortKey, sortDir]);

  const groupOptions = useMemo(() => {
    const map = {};
    directory.forEach((item) => {
      const group = String(item.group || "").trim();
      if (group) {
        map[group] = true;
      }
    });
    return Object.keys(map).sort((a, b) => a.localeCompare(b, "zh-Hant", { numeric: true }));
  }, [directory]);

  const toggleSort_ = (nextKey) => {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  };

  const getIdToken_ = async () => {
    const token = await getGoogleIdTokenSilently_();
    if (!token) {
      throw new Error("登入已過期，請重新使用 Google 登入。");
    }
    return token;
  };

  const loadDirectory = async () => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const idToken = await getIdToken_();
      const { result } = await apiRequest({ action: "listDirectory", idToken: idToken });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "載入失敗");
      }
      setDirectory(Array.isArray(result.data && result.data.directory) ? result.data.directory : []);
    } catch (err) {
      const message = String((err && err.message) || "");
      if (message === "Unauthorized") {
        setError("您目前沒有權限查看通訊錄（僅班代與資管組組長可查看）。");
      } else if (message.includes("Silent login unavailable") || message.includes("No credential")) {
        setError("登入已過期，請重新使用 Google 登入。");
      } else {
        setError(message || "載入失敗");
      }
      setDirectory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      setDirectory([]);
      return;
    }
    loadDirectory();
  }, [googleLinkedStudent && googleLinkedStudent.email]);

  if (!googleLinkedStudent || !googleLinkedStudent.email) {
    return (
      <div className="min-h-screen">
        <header className="px-6 pt-8 sm:px-12">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">NTU EMBA 115B</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">同學資料庫</h1>
            </div>
            <a
              href="/"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              回首頁
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 pb-28 pt-10 sm:px-12">
          <section className="card p-7 sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">Google 登入</h2>
            <p className="mt-2 text-sm text-slate-500">僅班代與資管組組長可查看通訊錄。</p>
            <div className="mt-5">
              <GoogleSigninPanel
                title="Google 登入"
                helperText="登入後會自動判斷是否有通訊錄查看權限。"
                onLinkedStudent={(student) => {
                  setGoogleLinkedStudent(student);
                  storeGoogleStudent_(student || null);
                }}
              />
            </div>
            {error ? <div className="mt-4 alert alert-error">{error}</div> : null}
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">NTU EMBA 115B</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">同學資料庫</h1>
          </div>
          <a
            href="/"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
          >
            回首頁
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-28 pt-10 sm:px-12">
        <section className="card p-7 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">同學列表</h2>
              <p className="mt-2 text-sm text-slate-500">僅班代與資管組組長可查看。</p>
            </div>
            <span className="text-xs text-slate-400">共 {filteredDirectory.length} 筆</span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <input
              value={directoryQuery}
              onChange={(event) => setDirectoryQuery(event.target.value)}
              placeholder="搜尋姓名、Email、公司、分組..."
              type="search"
              inputMode="search"
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
            />
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="h-10 min-w-[110px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400"
            >
              <option value="all">全部分組</option>
              {groupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              載入中...
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 alert alert-error">{error}</div>
          ) : null}

          {!loading && !error ? (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
              <table className="min-w-[980px] w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort_("nameZh")} className="font-semibold">
                        姓名 {sortKey === "nameZh" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort_("id")} className="font-semibold">
                        學號 {sortKey === "id" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort_("group")} className="font-semibold">
                        分組 {sortKey === "group" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort_("company")} className="font-semibold">
                        公司 {sortKey === "company" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-3">職稱</th>
                    <th className="px-3 py-3">手機</th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort_("birthday")} className="font-semibold">
                        生日 {sortKey === "birthday" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDirectory.map((item) => (
                    <tr key={item.id || item.email} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{item.nameZh || "未命名"}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.preferredName || item.nameEn || "-"}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{item.id || "-"}</td>
                      <td className="px-3 py-3">{item.group || "-"}</td>
                      <td className="px-3 py-3 text-xs">{item.email || "-"}</td>
                      <td className="px-3 py-3">{item.company || "-"}</td>
                      <td className="px-3 py-3">{item.title || "-"}</td>
                      <td className="px-3 py-3">{item.mobile || "-"}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {item.birthdayMonth && item.birthdayDay ? `${item.birthdayMonth}/${item.birthdayDay}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!sortedDirectory.length ? (
                <div className="rounded-2xl border-t border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  目前沒有可顯示資料
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
