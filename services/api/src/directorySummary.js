export function toDirectorySummaryEntry(row) {
  if (!row) {
    return null;
  }
  return {
    nameZh: String(row.name_zh || "").trim(),
    group: String(row.group_id || "").trim(),
    company: String(row.company || "").trim(),
    title: String(row.title || "").trim(),
  };
}
