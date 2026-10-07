import React, { useState } from "react";

const blank = () => ({ id: "", name: "", approverId: "", active: true });
export default function FinanceProjectsAdmin({ projects, students, apiRequest, onSaved }) {
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const save = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const { result } = await apiRequest({ action: "upsertFinanceProject", data: form });
      if (!result.ok) throw new Error(result.error || "儲存失敗");
      await onSaved(); setForm(blank()); setNotice("專案設定已儲存");
    } catch (err) { setError(err.message || "儲存失敗"); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
    <h2 className="font-semibold">專案項目與加簽負責人</h2>
    <p className="text-sm text-slate-500">每個專案一位負責人。設定變更只影響新送出或退回重送的案件；已送出案件保留原負責人。停用後不再提供新申請選用。</p>
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-emerald-700">{notice}</p> : null}
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">專案名稱<input className="input-sm mt-1 w-full" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="text-sm">加簽負責人<select className="input-sm mt-1 w-full" required value={form.approverId} onChange={(e) => setForm({ ...form, approverId: e.target.value })}>
        <option value="">請選擇同學</option>
        {students.map((item) => <option key={item.id} value={item.id}>{item.name || item.nameZh || item.id}</option>)}
      </select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />啟用專案</label>
      <div className="flex gap-2"><button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-3 text-white disabled:opacity-50">{busy ? "儲存中…" : form.id ? "儲存修改" : "新增專案"}</button>
        {form.id ? <button type="button" disabled={busy} className="rounded-xl border px-4 py-3" onClick={() => setForm(blank())}>取消編輯</button> : null}</div>
    </form>
    <div className="space-y-2">{projects.length ? projects.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <div className="min-w-0 break-words"><p className="font-medium">{item.name}{!item.active ? "（已停用）" : ""}</p><p className="text-sm text-slate-500">加簽：{item.approverName}</p></div>
      <button className="shrink-0 rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={() => { setForm({ ...item }); setNotice(""); }}>編輯</button>
    </div>) : <p className="text-sm text-slate-500">尚無專案，可在上方新增。</p>}</div>
  </section>;
}
