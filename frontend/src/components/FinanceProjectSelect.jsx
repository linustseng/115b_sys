import React from "react";

export default function FinanceProjectSelect({ projects = [], value = "", onChange }) {
  const selected = projects.find((item) => item.id === value);
  return <div className="grid gap-2 sm:col-span-2">
    <label className="text-sm font-medium text-slate-700">專案項目（選填）
      <select aria-label="專案項目" className="input-sm mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">無專案</option>
        {projects.filter((item) => item.active || item.id === value).map((item) =>
          <option key={item.id} value={item.id} disabled={!item.active}>{item.name} · {item.approverName}{!item.active ? "（已停用，請重選）" : ""}</option>)}
        {value && !selected ? <option value={value} disabled>原專案已不存在，請重選</option> : null}
      </select>
    </label>
    <p className="text-xs text-slate-500">{selected ? `送出後先由 ${selected.approverName} 加簽，再進入原簽核流程；本人申請時自動跳過加簽。` : "無專案沿用原簽核流程。專案及負責人由財務組維護。"}</p>
  </div>;
}
