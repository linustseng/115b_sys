import React, { useEffect, useState } from "react";

const levelStyle = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  critical: "border-rose-200 bg-rose-50 text-rose-800",
  unknown: "border-slate-200 bg-slate-50 text-slate-700",
};

const levelLabel = { normal: "正常", warning: "注意（≥ 70%）", high: "高（≥ 85%）", critical: "嚴重（≥ 95%）", unknown: "未評估" };
const categoryLabel = { image: "圖片", video: "影片", audio: "音訊", document: "文件", other: "其他" };
const gb = 1_000_000_000;

function formatGB(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return "—";
  return `${(Number(bytes) / gb).toFixed(2)} GB`;
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString("zh-TW", { hour12: false });
}

export default function StorageMonitoringPage({ shared }) {
  const { API_V2_URL, loadStoredAdminSession_ } = shared;
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const session = loadStoredAdminSession_();
      const response = await fetch(`${String(API_V2_URL || "").replace(/\/$/, "")}/v1/admin/storage-monitoring`, {
        headers: { Authorization: `Bearer ${session?.token || ""}` },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || "無法讀取儲存空間資訊");
      setSnapshot(body.data || null);
    } catch (cause) {
      setSnapshot(null); setError(cause.message || "無法讀取儲存空間資訊");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const quotaAvailable = snapshot?.quota?.status === "configured_project_quota";
  const usage = snapshot?.usagePercent;
  const warningLevel = snapshot?.warningLevel || "unknown";

  return <main className="min-h-screen bg-slate-50 px-4 py-7 sm:px-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold tracking-[.25em] text-cyan-700">ADMIN · STORAGE</p><h1 className="mt-2 text-3xl font-bold text-slate-900">儲存空間監控</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">僅顯示 Supabase Storage 實際物件大小快照；不以活動相簿或附件資料表加總代替。</p></div>
      <div className="flex gap-2"><a href="/admin" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">系統後台</a><button type="button" onClick={load} disabled={loading} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? "更新中…" : "重新整理"}</button></div>
    </div>
    {error ? <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">目前無法取得儲存空間快照</p><p className="mt-1">{error}</p><p className="mt-2 text-xs">請確認後端可查詢 Supabase Storage system catalog；前端不會、也不應持有 service key。</p></div> : null}
    {!snapshot && !error ? <p className="mt-10 text-sm text-slate-500">正在讀取安全的後端快照…</p> : null}
    {snapshot ? <>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-slate-500">實際已用</p><p className="mt-2 text-2xl font-bold text-slate-900">{formatGB(snapshot.actualUsedBytes)}</p><p className="mt-1 text-xs text-slate-500">{Number(snapshot.actualUsedBytes || 0).toLocaleString()} bytes</p></article>
        <article className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-slate-500">可用配額 / 方案</p><p className="mt-2 text-xl font-bold text-slate-900">{quotaAvailable ? formatGB(snapshot.quota.bytes) : "未設定"}</p><p className="mt-1 text-xs text-slate-500">{quotaAvailable ? snapshot.quota.planLabel || "已設定專案配額" : "不從方案名稱猜測組織配額"}</p></article>
        <article className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-slate-500">剩餘</p><p className="mt-2 text-2xl font-bold text-slate-900">{quotaAvailable ? formatGB(snapshot.remainingBytes) : "—"}</p><p className="mt-1 text-xs text-slate-500">{quotaAvailable ? "以已設定專案配額計算" : "需要經核准的配額設定"}</p></article>
        <article className={`rounded-3xl border p-5 ${levelStyle[warningLevel]}`}><p className="text-xs font-semibold">使用率</p><p className="mt-2 text-2xl font-bold">{usage == null ? "—" : `${usage}%`}</p><p className="mt-1 text-xs">{levelLabel[warningLevel]}</p></article>
      </section>
      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">快照與警戒</h2><p className="mt-1 text-sm text-slate-600">本次快照：{formatTime(snapshot.observedAt)}（{snapshot.trend?.status === "snapshot_only" ? "尚無歷史趨勢" : "趨勢資料"}）</p></div><p className="text-xs text-slate-500">警戒門檻：70% / 85% / 95%</p></div>
        {quotaAvailable ? <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className={warningLevel === "critical" ? "h-full bg-rose-500" : warningLevel === "high" ? "h-full bg-orange-500" : warningLevel === "warning" ? "h-full bg-amber-500" : "h-full bg-emerald-500"} style={{ width: `${Math.min(100, Math.max(0, usage || 0))}%` }} /></div> : <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">未提供可靠的專案配額，故不顯示剩餘空間或使用率預估。</p>}
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">依 Storage bucket</h2><p className="mt-1 text-xs text-slate-500">實測：Supabase Storage 物件 metadata</p><div className="mt-4 space-y-3">{snapshot.buckets?.length ? snapshot.buckets.map((item) => <div key={item.bucket} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm"><div><p className="font-medium text-slate-800">{item.bucket}</p><p className="text-xs text-slate-500">{Number(item.objectCount || 0).toLocaleString()} objects</p></div><p className="font-semibold text-slate-800">{formatGB(item.sizeBytes)}</p></div>) : <p className="text-sm text-slate-500">目前沒有可計量的 Storage 物件。</p>}</div></article>
        <article className="rounded-3xl bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">依檔案類型</h2><p className="mt-1 text-xs text-slate-500">依 Storage metadata 的 MIME type 分類；未知類型歸入「其他」。</p><div className="mt-4 space-y-3">{snapshot.categories?.length ? snapshot.categories.map((item) => <div key={item.category} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm"><div><p className="font-medium text-slate-800">{categoryLabel[item.category] || item.category}</p><p className="text-xs text-slate-500">{Number(item.objectCount || 0).toLocaleString()} objects</p></div><p className="font-semibold text-slate-800">{formatGB(item.sizeBytes)}</p></div>) : <p className="text-sm text-slate-500">目前沒有可分類的 Storage 物件。</p>}</div></article>
      </section>
      <section className="mt-5 rounded-3xl border border-cyan-100 bg-cyan-50 p-5 text-sm text-cyan-950"><h2 className="font-semibold">資料來源與限制</h2><p className="mt-2">{snapshot.measurement?.source} · {snapshot.measurement?.note}</p><p className="mt-1">配額：{snapshot.quota?.source}</p>{snapshot.needsConfiguration?.length ? <p className="mt-3">尚需 Mary/Linus 在後端設定：{snapshot.needsConfiguration.join("；")}。只需填入經核准、限定此專案的配額數值；不需要把 service key 放進前端。</p> : null}</section>
    </> : null}
  </div></main>;
}
