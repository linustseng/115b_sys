import React, { useEffect, useMemo, useState } from "react";
import { mapAppErrorMessage } from "../utils/errorMappings";
import {
  buildDirectoryClipboardText,
  copyTextToClipboard,
  DIRECTORY_PUBLIC_COLUMNS,
} from "../utils/directoryClipboard";

export default function DirectoryPage({ shared }) {
  const {
    apiRequest,
    GoogleSigninPanel,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
  } = shared;

  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sortKey, setSortKey] = useState("nameZh");
  const [sortDir, setSortDir] = useState("asc");
  const [copyStatus, setCopyStatus] = useState("");

  const matchesDirectoryQuery_ = (item, query) => {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) {
      return true;
    }
    const haystack = [
      item.nameZh,
      item.group,
      item.company,
      item.title,
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

  const handleCopyDirectory = async () => {
    if (!sortedDirectory.length) {
      return;
    }
    try {
      await copyTextToClipboard(
        buildDirectoryClipboardText(sortedDirectory, DIRECTORY_PUBLIC_COLUMNS)
      );
      setCopyStatus(`已複製 ${sortedDirectory.length} 筆，可直接貼到 Excel`);
    } catch (copyError) {
      setCopyStatus("複製失敗，請稍後再試");
    }
  };

  const toggleSort_ = (nextKey) => {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  };

  const loadDirectory = async () => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listDirectorySummary" });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "載入失敗");
      }
      setDirectory(Array.isArray(result.data && result.data.directory) ? result.data.directory : []);
    } catch (err) {
      const message = String((err && err.message) || "");
      setError(
        mapAppErrorMessage(message, {
          reauthMessage: "目前無法自動恢復登入狀態，請重新登入後再試。",
          forbiddenMessage: "您目前沒有權限查看在學名單，請確認已使用班級系統帳號登入。",
          fallbackMessage: message || "載入失敗",
        })
      );
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
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">在學同學名單</h1>
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
            <p className="mt-2 text-sm text-slate-500">班級同學登入後可查看姓名、分組、公司與職稱。</p>
            <div className="mt-5">
              <GoogleSigninPanel
                title="Google 登入"
                helperText="登入後會自動確認班級同學身分。"
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
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">在學同學名單</h1>
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
              <p className="mt-2 text-sm text-slate-500">一般同學可查看及複製非敏感欄位。</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {copyStatus ? <span className="text-xs text-slate-500">{copyStatus}</span> : null}
              <span className="text-xs text-slate-400">共 {sortedDirectory.length} 筆</span>
              <button
                type="button"
                onClick={handleCopyDirectory}
                disabled={!sortedDirectory.length}
                className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                複製 Excel 表格
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <input
              value={directoryQuery}
              onChange={(event) => setDirectoryQuery(event.target.value)}
              placeholder="搜尋姓名、公司、職稱、分組..."
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
              <table className="min-w-[640px] w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort_("nameZh")} className="font-semibold">
                        姓名 {sortKey === "nameZh" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort_("group")} className="font-semibold">
                        分組 {sortKey === "group" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button type="button" onClick={() => toggleSort_("company")} className="font-semibold">
                        公司 {sortKey === "company" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="px-3 py-3">職稱</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDirectory.map((item) => (
                    <tr key={[item.nameZh || "student", item.group || ""].join("-")} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{item.nameZh || "未命名"}</p>
                      </td>
                      <td className="px-3 py-3">{item.group || "-"}</td>
                      <td className="px-3 py-3">{item.company || "-"}</td>
                      <td className="px-3 py-3">{item.title || "-"}</td>
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
