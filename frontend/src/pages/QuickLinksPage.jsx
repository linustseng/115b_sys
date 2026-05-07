import React, { useEffect, useState } from "react";

const fallbackQuickLinks = [
  {
    id: "ntu-webmail",
    title: "臺大 Webmail",
    description: "快速開啟臺大信箱，處理學校與課務通知。",
    url: "https://webmail.ntu.edu.tw/",
    category: "學校系統",
  },
];

function QuickLinksPage({ shared }) {
  const { apiRequest } = shared;
  const [quickLinks, setQuickLinks] = useState(fallbackQuickLinks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    const loadQuickLinks_ = async () => {
      setLoading(true);
      setError("");
      try {
        const { result } = await apiRequest({ action: "listQuickLinks" });
        if (ignore) {
          return;
        }
        if (!result || !result.ok) {
          throw new Error((result && result.error) || "載入失敗");
        }
        const links = result.data && Array.isArray(result.data.quickLinks) ? result.data.quickLinks : [];
        setQuickLinks(links.length ? links : fallbackQuickLinks);
      } catch (err) {
        if (!ignore) {
          setError(String((err && err.message) || "常用鏈結載入失敗"));
          setQuickLinks(fallbackQuickLinks);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    loadQuickLinks_();
    return () => {
      ignore = true;
    };
  }, [apiRequest]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600">Quick Links</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">常用鏈結</h1>
            <p className="mt-2 text-sm text-slate-500">常用外部系統入口集中在這裡，需要維護請到系統後台。</p>
          </div>
          <a href="/" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-slate-300">
            回首頁
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-28 pt-8 sm:px-12">
        {error ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}，暫時顯示預設鏈結。
          </div>
        ) : null}
        {loading ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">載入中...</div>
        ) : null}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((item) => {
            const url = String(item.url || "").trim();
            return (
              <a
                key={item.id || item.title}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="group flex min-h-44 flex-col justify-between rounded-[2rem] border border-cyan-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                      {item.category || "Link"}
                    </span>
                    <span className="text-lg text-cyan-700 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h2>
                  {item.description ? <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p> : null}
                </div>
                <p className="mt-5 truncate text-xs text-cyan-700">{url}</p>
              </a>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default QuickLinksPage;
