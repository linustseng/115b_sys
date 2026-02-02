export function parseDirectoryImport_(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line);
  if (!lines.length) {
    return [];
  }
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((header) => header.trim());
  const map = {
    ID: "id",
    Id: "id",
    id: "id",
    學號: "id",
    同學ID: "id",
    組別: "group",
    Group: "group",
    "Email 信箱": "email",
    Email: "email",
    email: "email",
    "中文姓名": "nameZh",
    "英文姓名": "nameEn",
    "希望大家怎麼叫妳/你（非必填）": "preferredName",
    "希望大家怎麼叫你": "preferredName",
    稱呼: "preferredName",
    公司: "company",
    公司名稱: "company",
    職稱: "title",
    職位: "title",
    "FB/IG  社群網站網址 (非必填)": "socialUrl",
    "FB/IG 社群網站網址 (非必填)": "socialUrl",
    "FB/IG 社群網站網址": "socialUrl",
    "行動電話": "mobile",
    "備用的連絡電話（公司或住家 ）": "backupPhone",
    "備用的連絡電話（公司或住家）": "backupPhone",
    "緊急聯絡人姓名（與您的關係)": "emergencyContact",
    "緊急聯絡人姓名": "emergencyContact",
    "緊急聯絡人/關係": "emergencyContact",
    "緊急聯絡人": "emergencyContact",
    "緊急聯絡人電話": "emergencyPhone",
    飲食禁忌: "dietaryRestrictions",
    飲食限制: "dietaryRestrictions",
  };
  const mapped = headers.map((header) => map[header] || "");
  return lines
    .slice(1)
    .map((line) => {
      const cols = line.split(delimiter).map((col) => col.trim());
      const record = {};
      mapped.forEach((key, index) => {
        if (!key) {
          return;
        }
        record[key] = cols[index] || "";
      });
      if (!record.email) {
        return null;
      }
      return record;
    })
    .filter(Boolean);
}

export function addDays_(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function pad2_(value) {
  return String(value).padStart(2, "0");
}

export function toLocalInput_(date, hours, minutes) {
  const safe = new Date(date);
  safe.setHours(hours, minutes, 0, 0);
  return `${safe.getFullYear()}-${pad2_(safe.getMonth() + 1)}-${pad2_(safe.getDate())}T${pad2_(
    safe.getHours()
  )}:${pad2_(safe.getMinutes())}`;
}

export function toLocalInputValue_(date) {
  return `${date.getFullYear()}-${pad2_(date.getMonth() + 1)}-${pad2_(date.getDate())}T${pad2_(
    date.getHours()
  )}:${pad2_(date.getMinutes())}`;
}

export function parseLocalInputDate_(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function addMinutes_(date, minutes) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

export function generateEventId_(date, category, events, seed) {
  const yymmdd = `${String(date.getFullYear()).slice(-2)}${pad2_(date.getMonth() + 1)}${pad2_(
    date.getDate()
  )}`;
  const suffixes = (events || [])
    .map((event) => String(event.id || ""))
    .filter((id) => id.startsWith(yymmdd))
    .map((id) => id.slice(yymmdd.length))
    .map((value) => parseInt(value, 10))
    .filter((value) => !isNaN(value));
  const seedValue = seed ? new Date(seed) : new Date();
  const seedDay = `${String(seedValue.getFullYear()).slice(-2)}${pad2_(
    seedValue.getMonth() + 1
  )}${pad2_(seedValue.getDate())}`;
  const baseIndex = parseInt(seedDay.slice(-2), 10) % 99;
  const next = suffixes.length ? Math.max.apply(null, suffixes) + 1 : baseIndex + 1;
  return `${yymmdd}${String(next).padStart(2, "0")}`;
}
