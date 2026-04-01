import React, { useEffect, useMemo, useState } from "react";

function OrderingPublicPage({ shared }) {
  const { apiRequest, formatDisplayDate_, formatDisplayDateNoMidnight_ } = shared;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pageData, setPageData] = useState(null);
  const [submitDone, setSubmitDone] = useState(null);
  const [form, setForm] = useState({
    guestName: "",
    guestGroup: "",
    guestContact: "",
    choice: "A",
    comment: "",
  });

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search || "");
    return String(params.get("token") || "").trim();
  }, []);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!token) {
        setError("缺少訂餐連結 token。");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const { result } = await apiRequest({ action: "getOrderPublicPage", token });
        if (!result || !result.ok) {
          throw new Error((result && result.error) || "載入失敗");
        }
        if (ignore) return;
        const data = result.data || null;
        setPageData(data);
        const firstChoice = (((data && data.plan && data.plan.choices) || [])[0] || {}).value || "A";
        setForm((prev) => ({ ...prev, choice: firstChoice }));
      } catch (err) {
        if (!ignore) {
          setError(String((err && err.message) || "載入失敗"));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, [apiRequest, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setError("缺少訂餐連結 token。");
      return;
    }
    if (!String(form.guestName || "").trim()) {
      setError("請先填寫姓名。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { result } = await apiRequest({
        action: "submitOrderPublicResponse",
        data: {
          token,
          ...form,
        },
      });
      if (!result || !result.ok) {
        if (result && result.data && result.data.duplicate) {
          throw new Error("你可能已經送出過這張訂餐單了；如需修改，請聯絡美食組協助處理。");
        }
        throw new Error((result && result.error) || "送出失敗");
      }
      setSubmitDone(result.data && result.data.response ? result.data.response : form);
    } catch (err) {
      setError(String((err && err.message) || "送出失敗"));
    } finally {
      setSaving(false);
    }
  };

  const plan = pageData && pageData.plan ? pageData.plan : null;
  const publicLink = pageData && pageData.publicLink ? pageData.publicLink : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">載入中...</p>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Ordering</p>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">外部訂餐</h1>
          <p className="mt-3 text-sm text-rose-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <main className="mx-auto max-w-lg space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">Guest Ordering</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">{(publicLink && publicLink.title) || (plan && plan.publicTitle) || (plan && plan.title) || "外部訂餐"}</h1>
          <div className="mt-3 space-y-1 text-sm text-slate-500">
            {plan && plan.date ? <p>日期：{formatDisplayDate_(plan.date) || plan.date}</p> : null}
            {(publicLink && publicLink.closeAt) || (plan && plan.closeAt) ? (
              <p>截止：{formatDisplayDateNoMidnight_((publicLink && publicLink.closeAt) || (plan && plan.closeAt)) || ((publicLink && publicLink.closeAt) || (plan && plan.closeAt))}</p>
            ) : null}
            {publicLink && publicLink.description ? <p className="pt-1 leading-6 text-slate-600">{publicLink.description}</p> : null}
          </div>
        </section>

        {submitDone ? (
          <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Done</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">已收到訂餐資料</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>姓名：{submitDone.guestName || submitDone.displayName || form.guestName}</p>
              <p>餐點：{submitDone.choiceLabel || (((plan && plan.choices) || []).find((item) => item.value === (submitDone.choice || form.choice)) || {}).label || "-"}</p>
              {(submitDone.guestGroup || form.guestGroup) ? <p>身分 / 班級：{submitDone.guestGroup || form.guestGroup}</p> : null}
              {(submitDone.comment || form.comment) ? <p>備註：{submitDone.comment || form.comment}</p> : null}
            </div>
            <p className="mt-4 text-xs text-slate-500">如需修改，請聯絡美食組協助處理。</p>
          </section>
        ) : (
          <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
            {plan && plan.isClosed ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">這張訂餐已截止。</div>
            ) : null}

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">姓名</label>
                <input
                  value={form.guestName}
                  onChange={(event) => setForm((prev) => ({ ...prev, guestName: event.target.value }))}
                  placeholder="例如：王小明"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">班級 / 身分</label>
                <input
                  value={form.guestGroup}
                  onChange={(event) => setForm((prev) => ({ ...prev, guestGroup: event.target.value }))}
                  placeholder="例如：115A / 學長姐 / 來賓"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">聯絡方式（選填）</label>
                <input
                  value={form.guestContact}
                  onChange={(event) => setForm((prev) => ({ ...prev, guestContact: event.target.value }))}
                  placeholder="手機或方便辨識的資訊"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">餐點</label>
                <div className="grid gap-3">
                  {((plan && plan.choices) || []).map((choice) => {
                    const selected = form.choice === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, choice: choice.value }))}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <p className="text-sm font-semibold">{choice.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">備註（選填）</label>
                <textarea
                  value={form.comment}
                  onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
                  rows={3}
                  placeholder="例如：不加飯 / 會後現場付款"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving || (plan && plan.isClosed)}
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "送出中..." : "送出訂餐"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

export default OrderingPublicPage;
