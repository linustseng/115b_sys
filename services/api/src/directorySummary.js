export function toDirectorySummaryEntry(row) {
  if (!row) {
    return null;
  }
  return {
    nameZh: String(row.name_zh || "").trim(),
    preferredName: String(row.preferred_name || "").trim(),
    nameEn: String(row.name_en || "").trim(),
    group: String(row.group_id || "").trim(),
    company: String(row.company || "").trim(),
    title: String(row.title || "").trim(),
  };
}
