const birthdayValue = (item) =>
  item.birthdayMonth && item.birthdayDay ? `${item.birthdayMonth}/${item.birthdayDay}` : "";

export const DIRECTORY_COLUMNS = [
  { label: "姓名", value: (item) => item.nameZh },
  { label: "學號", value: (item) => item.id },
  { label: "分組", value: (item) => item.group },
  { label: "Email", value: (item) => item.email },
  { label: "稱呼", value: (item) => item.preferredName },
  { label: "英文名", value: (item) => item.nameEn },
  { label: "公司", value: (item) => item.company },
  { label: "職稱", value: (item) => item.title },
  { label: "手機", value: (item) => item.mobile },
  { label: "社群", value: (item) => item.socialUrl },
  { label: "備用電話", value: (item) => item.backupPhone },
  { label: "緊急聯絡人", value: (item) => item.emergencyContact },
  { label: "緊急聯絡人電話", value: (item) => item.emergencyPhone },
  { label: "生日", value: birthdayValue },
  { label: "飲食禁忌", value: (item) => item.dietaryRestrictions },
];

export const DIRECTORY_PUBLIC_COLUMNS = DIRECTORY_COLUMNS.filter((column) =>
  ["姓名", "分組", "公司", "職稱"].includes(column.label)
);

const normalizeCell_ = (value) =>
  String(value == null ? "" : value)
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ");

export const buildDirectoryClipboardText = (items, columns = DIRECTORY_COLUMNS) => {
  const rows = [columns.map((column) => column.label)];
  (Array.isArray(items) ? items : []).forEach((item) => {
    rows.push(columns.map((column) => normalizeCell_(column.value(item || {}))));
  });
  return rows.map((row) => row.join("\t")).join("\n");
};

export const copyTextToClipboard = async (text) => {
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document === "undefined") {
    throw new Error("Clipboard unavailable");
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
};
