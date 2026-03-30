import React, { useEffect, useMemo, useRef, useState } from "react";
import { isStandalonePwa_, resolveAndOpenAttachment_ } from "../utils/attachments";

const DOC_TYPE_OPTIONS = [
  { id: "all", label: "全部類型" },
  { id: "charter", label: "章程" },
  { id: "policy", label: "制度文件" },
  { id: "meeting_minutes", label: "班會記錄" },
  { id: "handover", label: "交接資料" },
  { id: "reference", label: "其他文件" },
];

const DOC_TYPE_SECTIONS = [
  { id: "governance", title: "章程 / 制度", docTypes: ["charter", "policy"], accent: "slate" },
  { id: "meetings", title: "班會記錄", docTypes: ["meeting_minutes"], accent: "sky" },
  { id: "handover", title: "交接 / SOP", docTypes: ["handover"], accent: "amber" },
  { id: "reference", title: "其他文件", docTypes: ["reference"], accent: "emerald" },
];

const DOCUMENT_TEMPLATES = {
  meeting_minutes: {
    label: "班會記錄模板",
    build(ownerGroupId = "A") {
      return {
        title: "",
        docType: "meeting_minutes",
        ownerGroupId,
        visibility: "class",
        tagsText: "班會, 會議記錄",
        summary: "",
        content: `# 會議資訊
- 會議名稱：
- 日期：
- 時間：
- 地點：
- 主席：
- 紀錄：

# 出席情況
- 出席：
- 請假：

# 議程
1. 
2. 
3. 

# 討論摘要
## 議題一
- 

## 議題二
- 

# 決議事項
1. 
2. 

# 待辦事項
- [ ] 項目：
  - 負責人：
  - 截止日：

# 備註
- `,
        changeSummary: "建立班會記錄",
        meetingDate: "",
        effectiveDate: "",
        attachments: [],
        isPinned: false,
        pinOrder: 0,
        meetingForm: {
          ...emptyMeetingForm(),
          agenda: "1. \n2. \n3. ",
          discussion: "## 議題一\n- \n\n## 議題二\n- ",
          resolutions: "1. \n2. ",
          actionItems: "- [ ] 項目：\n  - 負責人：\n  - 截止日：",
          notes: "- ",
        },
      };
    },
  },
  charter: {
    label: "章程模板",
    build(ownerGroupId = "A") {
      return {
        title: "組織章程",
        docType: "charter",
        ownerGroupId,
        visibility: "class",
        tagsText: "章程, 制度",
        summary: "",
        content: `# 文件資訊
- 文件名稱：
- 版本：
- 生效日期：
- 修訂摘要：

# 第一章 總則
## 第一條

## 第二條

# 第二章 組織與職掌
## 第三條

## 第四條

# 第三章 會議與決議
## 第五條

# 第四章 附則
## 第六條
`,
        changeSummary: "建立章程初版",
        meetingDate: "",
        effectiveDate: "",
        attachments: [],
        isPinned: true,
        pinOrder: 10,
        meetingForm: emptyMeetingForm(),
      };
    },
  },
  handover: {
    label: "交接文件模板",
    build(ownerGroupId = "A") {
      return {
        title: "",
        docType: "handover",
        ownerGroupId,
        visibility: "class",
        tagsText: "交接, SOP",
        summary: "",
        content: `# 背景
- 目的：
- 適用情境：

# 作業流程
1. 
2. 
3. 

# 關鍵聯絡窗口
- 

# 常見問題 / 注意事項
- 

# 相關附件 / 連結
- `,
        changeSummary: "建立交接文件初版",
        meetingDate: "",
        effectiveDate: "",
        attachments: [],
        isPinned: false,
        pinOrder: 0,
        meetingForm: emptyMeetingForm(),
      };
    },
  },
};

function normalizeTemplateText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/^\s*[-*]\s*(?:\[\s?\]\s*)?(?:項目|負責人|截止日|目的|適用情境|文件名稱|版本|生效日期|修訂摘要|會議名稱|日期|時間|地點|主席|紀錄|出席|請假|缺席|相關附件\s*\/\s*連結|關鍵聯絡窗口|常見問題\s*\/\s*注意事項)\s*：?\s*$/gm, "")
    .replace(/^\s*[-*]\s*$/gm, "")
    .replace(/^\s*\d+\.\s*$/gm, "")
    .replace(/^\s*#+\s*第?[一二三四五六七八九十0-9]+(?:章|條)?\s*.*$/gm, "")
    .replace(/^\s*#+\s*(會議資訊|出席情況|議程|討論摘要|決議事項|待辦事項|備註|文件資訊|背景|作業流程)\s*$/gm, "")
    .replace(/^\s*##\s*議題[一二三四五六七八九十0-9]+\s*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTemplateLikeSummary(summary) {
  const text = String(summary || "").trim();
  if (!text) {
    return true;
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (["文件摘要", "可留白，系統會依討論摘要 / 決議事項自動產生", "尚無摘要"].includes(normalized)) {
    return true;
  }
  const stripped = normalized
    .replace(/##\s*議題[一二三四五六七八九十0-9]+/g, "")
    .replace(/-\s*\[\s?\]\s*項目：?/g, "")
    .replace(/-\s*負責人：?/g, "")
    .replace(/-\s*截止日：?/g, "")
    .replace(/\b\d+\./g, "")
    .replace(/[-•：:]/g, "")
    .replace(/\s+/g, "")
    .trim();
  return !stripped;
}

function hasMeaningfulDocumentContent(docType, content) {
  const text = String(content || "").trim();
  if (!text) {
    return false;
  }
  if (docType === "meeting_minutes") {
    const parsed = parseMeetingMinutesContent(text);
    const cards = renderMeetingMinutesDetail(parsed, null);
    return cards.length > 0;
  }
  const templateBuilder = DOCUMENT_TEMPLATES[docType] && DOCUMENT_TEMPLATES[docType].build;
  const templateContent = typeof templateBuilder === "function" ? templateBuilder("A").content : "";
  const normalizedActual = normalizeTemplateText(text);
  const normalizedTemplate = normalizeTemplateText(templateContent);
  if (!normalizedActual) {
    return false;
  }
  if (normalizedTemplate && normalizedActual === normalizedTemplate) {
    return false;
  }
  return normalizedActual.length >= 12;
}

function getCleanSummary_(summary, fallback = "") {
  return isTemplateLikeSummary(summary) ? String(fallback || "").trim() : String(summary || "").trim();
}

function emptyMeetingForm() {
  return {
    meetingName: "",
    meetingDate: "",
    meetingTime: "",
    location: "",
    chairperson: "",
    recorder: "",
    attendees: "",
    absentees: "",
    agenda: "",
    discussion: "",
    resolutions: "",
    actionItems: "",
    notes: "",
  };
}

function hasMeetingFormContent(form) {
  if (!form || typeof form !== "object") {
    return false;
  }
  return Object.values(form).some((value) => String(value || "").trim());
}

function buildMeetingMinutesContent(draft) {
  const form = draft && draft.meetingForm ? draft.meetingForm : emptyMeetingForm();
  const meetingDate = String(form.meetingDate || "").trim() || String((draft && draft.meetingDate) || "").trim();
  const meetingTime = String(form.meetingTime || "").trim();
  const dateLine = [meetingDate, meetingTime].filter(Boolean).join(" ");
  return `# 會議資訊
- 會議名稱：${String(form.meetingName || "").trim()}
- 日期：${dateLine}
- 地點：${String(form.location || "").trim()}
- 主席：${String(form.chairperson || "").trim()}
- 紀錄：${String(form.recorder || "").trim()}

# 出席情況
- 出席：${String(form.attendees || "").trim()}
- 請假：${String(form.absentees || "").trim()}

# 議程
${String(form.agenda || "").trim()}

# 討論摘要
${String(form.discussion || "").trim()}

# 決議事項
${String(form.resolutions || "").trim()}

# 待辦事項
${String(form.actionItems || "").trim()}

# 備註
${String(form.notes || "").trim()}`;
}

function buildMeetingMinutesSummary(draft) {
  const form = draft && draft.meetingForm ? draft.meetingForm : emptyMeetingForm();
  const parts = [form.discussion, form.resolutions, form.actionItems]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return joined ? joined.slice(0, 120) : "";
}

function parseMeetingMinutesContent(content) {
  const raw = String(content || "").replace(/\r/g, "");
  const headings = ["會議資訊", "出席情況", "議程", "討論摘要", "決議事項", "待辦事項", "備註"];
  const sections = {};
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const startToken = `# ${heading}`;
    const start = raw.indexOf(startToken);
    if (start === -1) {
      sections[heading] = "";
      continue;
    }
    let end = raw.length;
    for (let nextIndex = index + 1; nextIndex < headings.length; nextIndex += 1) {
      const nextStart = raw.indexOf(`# ${headings[nextIndex]}`, start + startToken.length);
      if (nextStart !== -1) {
        end = nextStart;
        break;
      }
    }
    sections[heading] = raw.slice(start + startToken.length, end).trim();
  }

  const infoLines = sections["會議資訊"]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const infoMap = {};
  infoLines.forEach((line) => {
    const parts = line.split("：");
    if (parts.length >= 2) {
      const key = String(parts.shift() || "").trim();
      const value = parts.join("：").trim();
      infoMap[key] = value;
    }
  });

  const attendanceLines = sections["出席情況"]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const attendanceMap = {};
  attendanceLines.forEach((line) => {
    const parts = line.split("：");
    if (parts.length >= 2) {
      const key = String(parts.shift() || "").trim();
      const value = parts.join("：").trim();
      attendanceMap[key] = value;
    }
  });

  const dateRaw = String(infoMap["日期"] || "").trim();
  const dateMatch = dateRaw.match(/\d{4}-\d{2}-\d{2}/);
  const timeMatch = dateRaw.match(/\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?/);

  return {
    meetingName: infoMap["會議名稱"] || "",
    date: dateRaw,
    meetingDate: dateMatch ? dateMatch[0] : "",
    meetingTime: timeMatch ? timeMatch[0] : "",
    location: infoMap["地點"] || "",
    chairperson: infoMap["主席"] || "",
    recorder: infoMap["紀錄"] || "",
    attendees: attendanceMap["出席"] || "",
    absentees: attendanceMap["請假"] || attendanceMap["缺席"] || "",
    agenda: sections["議程"] || "",
    discussion: sections["討論摘要"] || "",
    resolutions: sections["決議事項"] || "",
    actionItems: sections["待辦事項"] || "",
    notes: sections["備註"] || "",
  };
}

function renderMeetingMinutesDetail(parsed, latestVersion) {
  const cards = [
    {
      title: "會議資訊",
      content: [
        parsed.meetingName ? `會議名稱：${parsed.meetingName}` : "",
        parsed.date ? `日期：${parsed.date}` : latestVersion && latestVersion.meetingDate ? `日期：${latestVersion.meetingDate}` : "",
        parsed.location ? `地點：${parsed.location}` : "",
        parsed.chairperson ? `主席：${parsed.chairperson}` : "",
        parsed.recorder ? `紀錄：${parsed.recorder}` : "",
      ].filter(Boolean).join("\n"),
    },
    {
      title: "出席情況",
      content: [
        parsed.attendees ? `出席：${parsed.attendees}` : "",
        parsed.absentees ? `請假 / 缺席：${parsed.absentees}` : "",
      ].filter(Boolean).join("\n"),
    },
    { title: "議程", content: parsed.agenda },
    { title: "討論摘要", content: parsed.discussion },
    { title: "決議事項", content: parsed.resolutions },
    { title: "待辦事項", content: parsed.actionItems },
    { title: "備註", content: parsed.notes },
  ].filter((item) => String(item.content || "").trim());

  return cards;
}

function buildDraftFromTemplate(templateKey, ownerGroupId = "A") {
  const template = DOCUMENT_TEMPLATES[templateKey];
  if (!template || typeof template.build !== "function") {
    return emptyDraft(ownerGroupId);
  }
  return template.build(ownerGroupId);
}

function emptyDraft(ownerGroupId = "A") {
  return {
    title: "",
    docType: "meeting_minutes",
    ownerGroupId,
    visibility: "class",
    tagsText: "",
    summary: "",
    content: "",
    changeSummary: "",
    meetingDate: "",
    effectiveDate: "",
    attachments: [],
    isPinned: false,
    pinOrder: 0,
    meetingForm: emptyMeetingForm(),
  };
}

function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: raw.includes("T") ? "2-digit" : undefined,
    minute: raw.includes("T") ? "2-digit" : undefined,
  });
}

function parseTags(text) {
  return String(text || "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function docTypeLabel(type) {
  const found = DOC_TYPE_OPTIONS.find((item) => item.id === type);
  return found ? found.label : type || "文件";
}

export default function DocumentsPage({ shared }) {
  const {
    apiRequest,
    API_V2_URL,
    loadStoredGoogleStudent_,
    storeGoogleStudent_,
    loadStoredGoogleIdToken_,
    storeGoogleIdToken_,
    getGoogleIdTokenSilently_,
    GoogleSigninPanel,
    CLASS_GROUPS,
  } = shared;

  const [googleLinkedStudent, setGoogleLinkedStudent] = useState(() => loadStoredGoogleStudent_());
  const [documents, setDocuments] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [editableGroupIds, setEditableGroupIds] = useState([]);
  const [canManageAll, setCanManageAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [versions, setVersions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editorMode, setEditorMode] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft("A"));
  const [showAdvancedRawContent, setShowAdvancedRawContent] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDraftId, setAttachmentDraftId] = useState(() => (
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  ));
  const uploadInputRef = useRef(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const attachmentActionLabel = isStandalonePwa_() ? "開啟附件" : "預覽附件";

  const groupLabelMap = useMemo(() => {
    const map = {};
    (Array.isArray(CLASS_GROUPS) ? CLASS_GROUPS : []).forEach((item) => {
      map[String(item.id || "").trim()] = String(item.label || item.id || "").trim();
    });
    return map;
  }, [CLASS_GROUPS]);

  const canCreate = editableGroupIds.length > 0 || canManageAll;

  const loadBootstrap = async (opts = {}) => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { result } = await apiRequest({ action: "listDocumentsBootstrap", includeArchived: !!opts.includeArchived });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "載入失敗");
      }
      const nextDocuments = Array.isArray(result.data && result.data.documents) ? result.data.documents : [];
      setDocuments(nextDocuments);
      setMemberships(Array.isArray(result.data && result.data.memberships) ? result.data.memberships : []);
      setEditableGroupIds(Array.isArray(result.data && result.data.editableGroupIds) ? result.data.editableGroupIds : []);
      setCanManageAll(Boolean(result.data && result.data.canManageAll));
      if (!selectedId && nextDocuments.length) {
        setSelectedId(String(nextDocuments[0].id || ""));
      }
    } catch (err) {
      setError(String((err && err.message) || "載入失敗"));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (documentId) => {
    const id = String(documentId || "").trim();
    if (!id) {
      setDetail(null);
      setVersions([]);
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    try {
      const [{ result: detailResult }, { result: versionsResult }] = await Promise.all([
        apiRequest({ action: "getDocumentDetail", id }),
        apiRequest({ action: "listDocumentVersions", documentId: id }),
      ]);
      if (!detailResult || !detailResult.ok) {
        throw new Error((detailResult && detailResult.error) || "載入文件失敗");
      }
      if (!versionsResult || !versionsResult.ok) {
        throw new Error((versionsResult && versionsResult.error) || "載入版本失敗");
      }
      setDetail({
        document: detailResult.data && detailResult.data.document ? detailResult.data.document : null,
        latestVersion: detailResult.data && detailResult.data.latestVersion ? detailResult.data.latestVersion : null,
        permissions: detailResult.data && detailResult.data.permissions ? detailResult.data.permissions : { canEdit: false, canManageAll: false },
      });
      setVersions(Array.isArray(versionsResult.data && versionsResult.data.versions) ? versionsResult.data.versions : []);
    } catch (err) {
      setDetailError(String((err && err.message) || "載入失敗"));
      setDetail(null);
      setVersions([]);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!googleLinkedStudent || !googleLinkedStudent.email) {
      setDocuments([]);
      setDetail(null);
      setVersions([]);
      return;
    }
    loadBootstrap();
  }, [googleLinkedStudent && googleLinkedStudent.email]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    setShowVersionHistory(false);
    loadDetail(selectedId);
  }, [selectedId]);

  const visibleDocuments = useMemo(() => {
    const needle = String(query || "").trim().toLowerCase();
    return documents.filter((item) => {
      if (String(item.status || "") === "archived") {
        return false;
      }
      if (docTypeFilter !== "all" && String(item.docType || "") !== docTypeFilter) {
        return false;
      }
      if (groupFilter !== "all" && String(item.ownerGroupId || "") !== groupFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        item.title,
        item.latestSummary,
        item.latestChangeSummary,
        ...(Array.isArray(item.tags) ? item.tags : []),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(needle);
    });
  }, [documents, query, docTypeFilter, groupFilter]);

  const pinnedDocuments = visibleDocuments.filter((item) => item.isPinned);
  const recentDocuments = visibleDocuments.filter((item) => !item.isPinned);
  const groupedRecentSections = DOC_TYPE_SECTIONS.map((section) => ({
    ...section,
    items: recentDocuments.filter((item) => section.docTypes.includes(String(item.docType || ""))),
  })).filter((section) => section.items.length > 0);

  const selectedDocument = detail && detail.document ? detail.document : null;
  const selectedLatestVersion = detail && detail.latestVersion ? detail.latestVersion : null;
  const selectedCanEdit = Boolean(detail && detail.permissions && detail.permissions.canEdit);
  const selectedSummary = isTemplateLikeSummary(selectedLatestVersion && selectedLatestVersion.summary)
    ? ""
    : String((selectedLatestVersion && selectedLatestVersion.summary) || "").trim();
  const selectedChangeSummary = String((selectedLatestVersion && selectedLatestVersion.changeSummary) || "").trim();
  const selectedHasMeaningfulContent = hasMeaningfulDocumentContent(
    selectedDocument && selectedDocument.docType,
    selectedLatestVersion && selectedLatestVersion.content
  );
  const parsedMeetingDetail = useMemo(() => {
    if (!selectedDocument || selectedDocument.docType !== "meeting_minutes") {
      return null;
    }
    return parseMeetingMinutesContent(selectedLatestVersion && selectedLatestVersion.content ? selectedLatestVersion.content : "");
  }, [selectedDocument, selectedLatestVersion]);
  const meetingDetailCards = useMemo(() => {
    if (!parsedMeetingDetail) {
      return [];
    }
    return renderMeetingMinutesDetail(parsedMeetingDetail, selectedLatestVersion);
  }, [parsedMeetingDetail, selectedLatestVersion]);

  const renderDocumentButton = (item, tone = "default") => {
    const isSelected = selectedId === item.id;
    const toneClassMap = {
      default: isSelected ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300",
      slate: isSelected ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20" : "border-slate-200 bg-white hover:border-slate-300",
      sky: isSelected ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-sky-200",
      amber: isSelected ? "border-amber-300 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-amber-200",
      emerald: isSelected ? "border-emerald-300 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200",
    };
    const mutedTextClass = isSelected && tone === "slate" ? "text-white/80" : "text-slate-500";
    const metaTextClass = isSelected && tone === "slate" ? "text-white/70" : "text-slate-400";
    const badgeClass = isSelected && tone === "slate" ? "rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white/90" : "badge";
    const mutedBadgeClass = isSelected && tone === "slate" ? "rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white/90" : "badge-muted";
    return (
      <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-3xl border px-4 py-4 text-left transition ${toneClassMap[tone] || toneClassMap.default}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={badgeClass}>{docTypeLabel(item.docType)}</span>
          <span className={mutedBadgeClass}>{groupLabelMap[item.ownerGroupId] || item.ownerGroupId}</span>
          <span className={mutedBadgeClass}>v{item.latestVersionNumber}</span>
        </div>
        <h3 className={`mt-3 text-base font-semibold ${isSelected && tone === "slate" ? "text-white" : "text-slate-900"}`}>{item.title}</h3>
        {getCleanSummary_(item.latestSummary, item.latestChangeSummary) ? (
          <p className={`mt-2 text-sm ${mutedTextClass}`}>{getCleanSummary_(item.latestSummary, item.latestChangeSummary)}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {(item.tags || []).slice(0, 4).map((tag) => <span key={tag} className={mutedBadgeClass}>#{tag}</span>)}
        </div>
        <p className={`mt-3 text-xs ${metaTextClass}`}>{groupLabelMap[item.ownerGroupId] || item.ownerGroupId} ・ 更新 {formatDate(item.updatedAt || item.latestVersionCreatedAt)}</p>
      </button>
    );
  };

  const renderEditorForm = () => (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{editorMode === "create" ? "新增文件" : editorMode === "version" ? "修改內容（發布新版本）" : "編輯文件資訊（不改正文）"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {editorMode === "version"
              ? "你正在原地修改這份文件。送出後會保留舊版本，並把新版設為最新內容。"
              : editorMode === "meta"
                ? "這裡只會更新標題、類型、組別、標籤等文件資訊，不會改到正文內容。"
                : "先把基本資料與內容填好，之後若要改正文，請用「修改內容」。"}
          </p>
        </div>
        <button type="button" onClick={() => setEditorMode("")} className="btn-ghost">關閉</button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-slate-50/70 p-3">
        <span className="self-center px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">快速模板</span>
        {Object.entries(DOCUMENT_TEMPLATES).map(([key, template]) => (
          <button key={key} type="button" onClick={() => applyTemplate(key)} className="btn-chip">
            {template.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          文件名稱
          <input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} className="input-base mt-2 w-full" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          文件類型
          <select value={draft.docType} onChange={(e) => setDraft((prev) => ({ ...prev, docType: e.target.value }))} className="input-base mt-2 w-full">
            {DOC_TYPE_OPTIONS.filter((item) => item.id !== "all").map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          所屬組別
          <select value={draft.ownerGroupId} onChange={(e) => setDraft((prev) => ({ ...prev, ownerGroupId: e.target.value }))} className="input-base mt-2 w-full" disabled={editorMode !== "meta" && !canManageAll && editableGroupIds.length === 1}>
            {(CLASS_GROUPS || []).filter((item) => canManageAll || editableGroupIds.includes(item.id) || item.id === draft.ownerGroupId).map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          標籤
          <input value={draft.tagsText} onChange={(e) => setDraft((prev) => ({ ...prev, tagsText: e.target.value }))} placeholder="章程, 班會, 財務" className="input-base mt-2 w-full" />
        </label>
        {draft.docType !== "meeting_minutes" ? (
          <label className="block text-sm font-medium text-slate-700">
            會議日期（選填）
            <input type="date" value={draft.meetingDate} onChange={(e) => setDraft((prev) => ({ ...prev, meetingDate: e.target.value }))} className="input-base mt-2 w-full" />
          </label>
        ) : null}
        <label className="block text-sm font-medium text-slate-700">
          生效日期（選填）
          <input type="date" value={draft.effectiveDate} onChange={(e) => setDraft((prev) => ({ ...prev, effectiveDate: e.target.value }))} className="input-base mt-2 w-full" />
        </label>
      </div>

      {editorMode !== "meta" ? (
        <>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            本次變更摘要
            <input value={draft.changeSummary} onChange={(e) => setDraft((prev) => ({ ...prev, changeSummary: e.target.value }))} placeholder="例如：新增財務核銷條文、補上 3/20 班會決議" className="input-base mt-2 w-full" />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            摘要
            <textarea value={draft.summary} onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))} rows={3} placeholder={draft.docType === "meeting_minutes" ? "可留白，系統會依討論摘要 / 決議事項自動產生" : "文件摘要"} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" />
          </label>
          {draft.docType === "meeting_minutes" ? (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">班會記錄表單</p>
                  <p className="mt-1 text-xs text-slate-500">先填結構化欄位，送出時會自動組成標準記錄格式。</p>
                </div>
                <span className="badge-success">結構化模板</span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">會議名稱<input value={draft.meetingForm.meetingName} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, meetingName: e.target.value } }))} className="input-base mt-2 w-full" /></label>
                <label className="block text-sm font-medium text-slate-700">日期<input type="date" value={draft.meetingForm.meetingDate} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, meetingDate: e.target.value } }))} className="input-base mt-2 w-full" /></label>
                <label className="block text-sm font-medium text-slate-700">時間<input value={draft.meetingForm.meetingTime} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, meetingTime: e.target.value } }))} placeholder="例如 19:00-21:00" className="input-base mt-2 w-full" /></label>
                <label className="block text-sm font-medium text-slate-700">地點<input value={draft.meetingForm.location} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, location: e.target.value } }))} className="input-base mt-2 w-full" /></label>
                <label className="block text-sm font-medium text-slate-700">主席 / 紀錄<div className="mt-2 grid gap-3 sm:grid-cols-2"><input value={draft.meetingForm.chairperson} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, chairperson: e.target.value } }))} placeholder="主席" className="input-base w-full" /><input value={draft.meetingForm.recorder} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, recorder: e.target.value } }))} placeholder="紀錄" className="input-base w-full" /></div></label>
                <label className="block text-sm font-medium text-slate-700">出席<textarea value={draft.meetingForm.attendees} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, attendees: e.target.value } }))} rows={3} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" /></label>
                <label className="block text-sm font-medium text-slate-700">請假 / 缺席<textarea value={draft.meetingForm.absentees} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, absentees: e.target.value } }))} rows={3} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" /></label>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="block text-sm font-medium text-slate-700">議程<textarea value={draft.meetingForm.agenda} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, agenda: e.target.value } }))} rows={4} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" /></label>
                <label className="block text-sm font-medium text-slate-700">討論摘要<textarea value={draft.meetingForm.discussion} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, discussion: e.target.value } }))} rows={6} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" /></label>
                <label className="block text-sm font-medium text-slate-700">決議事項<textarea value={draft.meetingForm.resolutions} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, resolutions: e.target.value } }))} rows={5} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" /></label>
                <label className="block text-sm font-medium text-slate-700">待辦事項<textarea value={draft.meetingForm.actionItems} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, actionItems: e.target.value } }))} rows={5} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" /></label>
                <label className="block text-sm font-medium text-slate-700">備註<textarea value={draft.meetingForm.notes} onChange={(e) => setDraft((prev) => ({ ...prev, meetingForm: { ...prev.meetingForm, notes: e.target.value } }))} rows={3} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" /></label>
                <div className="block text-sm font-medium text-slate-700">
                  <button type="button" onClick={() => setShowAdvancedRawContent((prev) => !prev)} className="btn-chip">
                    {showAdvancedRawContent ? "收合進階原始內容" : "展開進階原始內容（舊版相容）"}
                  </button>
                  {showAdvancedRawContent ? (
                    <textarea value={draft.content} onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))} rows={8} placeholder="只有舊資料匯入或特殊排版才需要填。一般維護請直接用上方表單。" className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" />
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <label className="mt-4 block text-sm font-medium text-slate-700">內容<textarea value={draft.content} onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))} rows={14} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400" /></label>
          )}
          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">附件</p>
                <p className="text-xs text-slate-500">可附 PDF / 圖片 / docx，先沿用現有上傳服務。</p>
              </div>
              <label className="btn-secondary cursor-pointer">
                {uploadingAttachment ? "上傳中..." : "上傳附件"}
                <input ref={uploadInputRef} type="file" className="hidden" onChange={(e) => handleUploadAttachment(e.target.files && e.target.files[0])} />
              </label>
            </div>
            <div className="mt-3 space-y-2">
              {(draft.attachments || []).map((item, index) => (
                <div key={`${item.url}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <button type="button" onClick={() => resolveAndOpenAttachment_(item, apiRequest).catch((err) => setStatusMessage(String((err && err.message) || "附件開啟失敗")))} className="truncate text-left hover:text-slate-900">{item.name || item.url}</button>
                  <button type="button" onClick={() => setDraft((prev) => ({ ...prev, attachments: (prev.attachments || []).filter((_, idx) => idx !== index) }))} className="btn-chip">移除</button>
                </div>
              ))}
              {!draft.attachments.length ? <p className="text-xs text-slate-400">尚未加入附件</p> : null}
            </div>
          </div>
        </>
      ) : null}

      {editorMode === "meta" && canManageAll ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            置頂
            <select value={draft.isPinned ? "yes" : "no"} onChange={(e) => setDraft((prev) => ({ ...prev, isPinned: e.target.value === "yes" }))} className="input-base mt-2 w-full">
              <option value="no">一般</option>
              <option value="yes">置頂</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            置頂順序
            <input type="number" value={draft.pinOrder} onChange={(e) => setDraft((prev) => ({ ...prev, pinOrder: Number(e.target.value || 0) }))} className="input-base mt-2 w-full" />
          </label>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => setEditorMode("")} className="btn-secondary">取消</button>
        <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary">
          {submitting ? "儲存中..." : editorMode === "create" ? "建立文件" : editorMode === "version" ? "發布新版內容" : "儲存資訊設定"}
        </button>
      </div>
    </>
  );

  const beginCreate = () => {
    setDraft(buildDraftFromTemplate("meeting_minutes", editableGroupIds[0] || "A"));
    setAttachmentDraftId(
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    );
    setShowAdvancedRawContent(false);
    setEditorMode("create");
    setStatusMessage("");
  };

  const applyTemplate = (templateKey) => {
    const ownerGroupId = draft.ownerGroupId || editableGroupIds[0] || "A";
    const next = buildDraftFromTemplate(templateKey, ownerGroupId);
    setDraft((prev) => ({
      ...prev,
      ...next,
      ownerGroupId,
      title: prev.title && templateKey !== "charter" ? prev.title : next.title,
      attachments: Array.isArray(prev.attachments) && prev.attachments.length ? prev.attachments : next.attachments,
    }));
  };

  const beginEditMeta = () => {
    if (!selectedDocument) {
      return;
    }
    setDraft({
      title: selectedDocument.title || "",
      docType: selectedDocument.docType || "reference",
      ownerGroupId: selectedDocument.ownerGroupId || editableGroupIds[0] || "A",
      visibility: selectedDocument.visibility || "class",
      tagsText: Array.isArray(selectedDocument.tags) ? selectedDocument.tags.join(", ") : "",
      summary: selectedLatestVersion && selectedLatestVersion.summary ? selectedLatestVersion.summary : "",
      content: selectedLatestVersion && selectedLatestVersion.content ? selectedLatestVersion.content : "",
      changeSummary: "",
      meetingDate: selectedLatestVersion && selectedLatestVersion.meetingDate ? selectedLatestVersion.meetingDate : "",
      effectiveDate: selectedLatestVersion && selectedLatestVersion.effectiveDate ? selectedLatestVersion.effectiveDate : "",
      attachments: selectedLatestVersion && Array.isArray(selectedLatestVersion.attachments) ? selectedLatestVersion.attachments : [],
      isPinned: Boolean(selectedDocument.isPinned),
      pinOrder: Number(selectedDocument.pinOrder || 0),
      meetingForm: emptyMeetingForm(),
    });
    setShowAdvancedRawContent(false);
    setEditorMode("meta");
    setStatusMessage("");
  };

  const beginCreateVersion = () => {
    if (!selectedDocument) {
      return;
    }
    setAttachmentDraftId(
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    );
    const parsedMeeting = selectedDocument.docType === "meeting_minutes"
      ? parseMeetingMinutesContent(selectedLatestVersion && selectedLatestVersion.content ? selectedLatestVersion.content : "")
      : null;
    setDraft({
      title: selectedDocument.title || "",
      docType: selectedDocument.docType || "reference",
      ownerGroupId: selectedDocument.ownerGroupId || editableGroupIds[0] || "A",
      visibility: selectedDocument.visibility || "class",
      tagsText: Array.isArray(selectedDocument.tags) ? selectedDocument.tags.join(", ") : "",
      summary: selectedLatestVersion && selectedLatestVersion.summary ? selectedLatestVersion.summary : "",
      content: selectedLatestVersion && selectedLatestVersion.content ? selectedLatestVersion.content : "",
      changeSummary: "",
      meetingDate: selectedLatestVersion && selectedLatestVersion.meetingDate ? selectedLatestVersion.meetingDate : "",
      effectiveDate: selectedLatestVersion && selectedLatestVersion.effectiveDate ? selectedLatestVersion.effectiveDate : "",
      attachments: selectedLatestVersion && Array.isArray(selectedLatestVersion.attachments) ? selectedLatestVersion.attachments : [],
      isPinned: Boolean(selectedDocument.isPinned),
      pinOrder: Number(selectedDocument.pinOrder || 0),
      meetingForm: parsedMeeting ? {
        ...emptyMeetingForm(),
        ...parsedMeeting,
        meetingDate: parsedMeeting.meetingDate || (selectedLatestVersion && selectedLatestVersion.meetingDate) || "",
      } : emptyMeetingForm(),
    });
    setShowAdvancedRawContent(false);
    setEditorMode("version");
    setStatusMessage("");
  };

  const handleUploadAttachment = async (file) => {
    if (!file) {
      return;
    }
    if (!API_V2_URL) {
      setStatusMessage("目前尚未設定 API v2，附件上傳未啟用");
      return;
    }
    let idToken = loadStoredGoogleIdToken_();
    if (!idToken && typeof getGoogleIdTokenSilently_ === "function") {
      try {
        idToken = await getGoogleIdTokenSilently_();
        if (idToken) {
          storeGoogleIdToken_(idToken);
        }
      } catch {
        // ignore
      }
    }
    if (!idToken) {
      setStatusMessage("請先完成 Google 登入，再上傳附件");
      return;
    }
    setUploadingAttachment(true);
    try {
      const base = API_V2_URL.endsWith("/") ? API_V2_URL.slice(0, -1) : API_V2_URL;
      const sendUpload_ = async (token) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("entityType", "document_version");
        formData.append("entityId", `draft:${attachmentDraftId}`);
        formData.append("attachmentKind", "reference");
        formData.append("ownerGroupId", String(draft.ownerGroupId || editableGroupIds[0] || "A"));
        return fetch(`${base}/v1/attachments/upload`, {
          method: "POST",
          headers: { "x-id-token": token },
          body: formData,
        });
      };
      let response = await sendUpload_(idToken);
      if (response.status === 401 && typeof getGoogleIdTokenSilently_ === "function") {
        try {
          const refreshed = String((await getGoogleIdTokenSilently_()) || "").trim();
          if (refreshed) {
            storeGoogleIdToken_(refreshed);
            idToken = refreshed;
            response = await sendUpload_(idToken);
          }
        } catch {
          // ignore silent refresh failure and surface original 401 below
        }
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error((payload && payload.error) || `上傳失敗 (HTTP ${response.status})`);
      }
      const data = payload.data || {};
      const item = data.item || {
        attachmentId: String(data.attachmentId || "").trim(),
        name: String(data.name || file.name || "附件").trim(),
        url: String(data.url || "").trim(),
        mimeType: String(data.mimeType || file.type || "").trim(),
        sizeBytes: Number(data.sizeBytes || file.size || 0),
        attachmentKind: String(data.attachmentKind || "reference").trim(),
      };
      if (!item.url) {
        throw new Error("上傳成功但缺少附件連結");
      }
      setDraft((prev) => ({
        ...prev,
        attachments: (prev.attachments || []).concat([item]),
      }));
      setStatusMessage("附件已加入");
    } catch (err) {
      setStatusMessage(String((err && err.message) || "附件上傳失敗"));
    } finally {
      setUploadingAttachment(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setStatusMessage("");
    try {
      const generatedMeetingContent = draft.docType === "meeting_minutes" && hasMeetingFormContent(draft.meetingForm)
        ? buildMeetingMinutesContent(draft)
        : "";
      const finalContent = generatedMeetingContent || draft.content;
      const finalSummary = draft.summary || (draft.docType === "meeting_minutes" ? buildMeetingMinutesSummary(draft) : "");
      const resolvedMeetingDate = draft.docType === "meeting_minutes"
        ? String((draft.meetingForm && draft.meetingForm.meetingDate) || draft.meetingDate || "").trim()
        : draft.meetingDate;
      if (editorMode === "create") {
        const { result } = await apiRequest({
          action: "createDocument",
          data: {
            title: draft.title,
            docType: draft.docType,
            ownerGroupId: draft.ownerGroupId,
            visibility: draft.visibility,
            tags: parseTags(draft.tagsText),
            summary: finalSummary,
            content: finalContent,
            changeSummary: draft.changeSummary || "初版建立",
            meetingDate: resolvedMeetingDate,
            effectiveDate: draft.effectiveDate,
            attachments: draft.attachments,
          },
        });
        if (!result || !result.ok) {
          throw new Error((result && result.error) || "建立失敗");
        }
        setEditorMode("");
        await loadBootstrap();
        setSelectedId(String(result.data && result.data.id ? result.data.id : ""));
        setStatusMessage("文件已建立");
      } else if (editorMode === "version" && selectedDocument) {
        const { result } = await apiRequest({
          action: "createDocumentVersion",
          data: {
            documentId: selectedDocument.id,
            title: draft.title,
            summary: finalSummary,
            content: finalContent,
            changeSummary: draft.changeSummary,
            meetingDate: resolvedMeetingDate,
            effectiveDate: draft.effectiveDate,
            attachments: draft.attachments,
          },
        });
        if (!result || !result.ok) {
          throw new Error((result && result.error) || "新增版本失敗");
        }
        setEditorMode("");
        await loadBootstrap();
        await loadDetail(selectedDocument.id);
        setStatusMessage("新版本已發布");
      } else if (editorMode === "meta" && selectedDocument) {
        const { result } = await apiRequest({
          action: "updateDocumentMeta",
          data: {
            documentId: selectedDocument.id,
            title: draft.title,
            docType: draft.docType,
            ownerGroupId: draft.ownerGroupId,
            visibility: draft.visibility,
            tags: parseTags(draft.tagsText),
            isPinned: draft.isPinned,
            pinOrder: draft.pinOrder,
          },
        });
        if (!result || !result.ok) {
          throw new Error((result && result.error) || "更新失敗");
        }
        setEditorMode("");
        await loadBootstrap();
        await loadDetail(selectedDocument.id);
        setStatusMessage("文件資訊已更新");
      }
    } catch (err) {
      setStatusMessage(String((err && err.message) || "儲存失敗"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedDocument) {
      return;
    }
    const yes = window.confirm(`要封存「${selectedDocument.title}」嗎？`);
    if (!yes) {
      return;
    }
    setSubmitting(true);
    setStatusMessage("");
    try {
      const { result } = await apiRequest({ action: "archiveDocument", documentId: selectedDocument.id });
      if (!result || !result.ok) {
        throw new Error((result && result.error) || "封存失敗");
      }
      await loadBootstrap();
      setDetail(null);
      setVersions([]);
      setSelectedId("");
      setStatusMessage("文件已封存");
    } catch (err) {
      setStatusMessage(String((err && err.message) || "封存失敗"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!googleLinkedStudent || !googleLinkedStudent.email) {
    return (
      <div className="min-h-screen">
        <header className="px-6 pt-8 sm:px-12">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">NTU EMBA 115B</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">班務文件中心</h1>
            </div>
            <a href="/" className="btn-ghost">回首頁</a>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-6 pb-24 pt-10 sm:px-12">
          <section className="card p-7 sm:p-10">
            <h2 className="text-lg font-semibold text-slate-900">請先登入後使用</h2>
            <p className="mt-2 text-sm text-slate-500">登入後即可查閱班會記錄、章程與各組文件。</p>
            <div className="mt-6">
              <GoogleSigninPanel
                title="Google 登入"
                helperText="登入後會自動帶入班級身分。"
                onLinkedStudent={(student) => {
                  setGoogleLinkedStudent(student);
                  storeGoogleStudent_(student || null);
                }}
              />
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-8 sm:px-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">NTU EMBA 115B</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">班務文件中心</h1>
            <p className="mt-3 text-sm text-slate-500">班會記錄、章程、制度文件與交接資料都集中在這裡。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/" className="btn-ghost">回首頁</a>
            {canCreate ? <button type="button" onClick={beginCreate} className="btn-primary">＋ 新增文件</button> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-28 pt-8 sm:px-12">
        <section className="card p-5 sm:p-6">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px,180px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋標題、摘要、標籤..."
              className="input-base w-full"
            />
            <select value={docTypeFilter} onChange={(event) => setDocTypeFilter(event.target.value)} className="input-base w-full">
              {DOC_TYPE_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="input-base w-full">
              <option value="all">全部組別</option>
              {(CLASS_GROUPS || []).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="badge">共 {visibleDocuments.length} 份文件</span>
            {editableGroupIds.length ? <span className="badge-success">可維護：{editableGroupIds.map((id) => groupLabelMap[id] || id).join("、")}</span> : null}
            {canManageAll ? <span className="badge-warning">管理權限</span> : null}
          </div>
          {statusMessage ? <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">{statusMessage}</div> : null}
          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        </section>

        {editorMode === "create" ? (
          <section className="card mt-6 p-5 sm:p-6">
            {renderEditorForm()}
          </section>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr),minmax(0,1.25fr)]">
          <section className="space-y-6">
            <div className="card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title">重要文件</h2>
                <span className="text-xs text-slate-400">{pinnedDocuments.length} 份</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">置頂文件會固定在最上面，適合章程、核心制度與常用交接資料。</p>
              <div className="mt-4 space-y-3">
                {pinnedDocuments.length ? pinnedDocuments.map((item) => renderDocumentButton(item, "slate")) : <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">目前沒有置頂文件</div>}
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">文件總覽</h2>
                  <p className="mt-1 text-sm text-slate-500">依文件用途分區，手機上也比較不會混在一起。</p>
                </div>
                <span className="text-xs text-slate-400">{recentDocuments.length} 份</span>
              </div>
              {loading ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">載入中...</div> : null}
              <div className="mt-5 space-y-5">
                {groupedRecentSections.length ? groupedRecentSections.map((section) => (
                  <section key={section.id} className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">{section.title}</h3>
                        <p className="mt-1 text-xs text-slate-400">{section.items.length} 份文件</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {section.items.map((item) => renderDocumentButton(item, section.accent))}
                    </div>
                  </section>
                )) : <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">找不到符合條件的文件</div>}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="card p-5 sm:p-6">
              {detailLoading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">載入文件中...</div> : null}
              {detailError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{detailError}</div> : null}
              {!detailLoading && !selectedDocument ? <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">左側選一份文件來查看內容</div> : null}
              {selectedDocument ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge">{docTypeLabel(selectedDocument.docType)}</span>
                        <span className="badge-muted">{groupLabelMap[selectedDocument.ownerGroupId] || selectedDocument.ownerGroupId}</span>
                        <span className="badge-muted">最新 v{selectedDocument.latestVersionNumber}</span>
                      </div>
                      <h2 className="mt-4 text-2xl font-semibold text-slate-900">{selectedDocument.title}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                        <span>更新時間：{formatDate(selectedDocument.updatedAt || (selectedLatestVersion && selectedLatestVersion.createdAt))}</span>
                        {selectedChangeSummary ? <span>本版更新：{selectedChangeSummary}</span> : null}
                      </div>
                    </div>
                    {selectedCanEdit ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={beginCreateVersion} className="btn-primary">修改內容</button>
                        <button type="button" onClick={beginEditMeta} className="btn-secondary">編輯資訊</button>
                        <button type="button" onClick={handleArchive} disabled={submitting} className="btn-ghost">封存</button>
                      </div>
                    ) : null}
                  </div>

                  {editorMode && editorMode !== "create" ? (
                    <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                      {renderEditorForm()}
                    </div>
                  ) : (
                    <>
                      {selectedSummary ? (
                        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">摘要</p>
                          <p className="mt-2 text-sm leading-7 text-slate-700">{selectedSummary}</p>
                        </div>
                      ) : null}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {(selectedDocument.tags || []).map((tag) => <span key={tag} className="badge-muted">#{tag}</span>)}
                      </div>

                      {selectedHasMeaningfulContent ? (
                        selectedDocument.docType === "meeting_minutes" && meetingDetailCards.length ? (
                          <div className="mt-6 grid gap-4">
                            {meetingDetailCards.map((card) => (
                              <section key={card.title} className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">{card.title}</h3>
                                <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{card.content}</div>
                              </section>
                            ))}
                          </div>
                        ) : (
                          <article className="mt-6 whitespace-pre-wrap break-words rounded-3xl border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-slate-800">
                            {selectedLatestVersion && selectedLatestVersion.content ? selectedLatestVersion.content : "尚無內容"}
                          </article>
                        )
                      ) : (
                        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center text-sm text-slate-400">
                          這份文件目前只有模板骨架，尚未補上正式內容。
                        </div>
                      )}

                      {(selectedLatestVersion && selectedLatestVersion.attachments && selectedLatestVersion.attachments.length) ? (
                        <div className="mt-6">
                          <h3 className="text-sm font-semibold text-slate-900">附件</h3>
                          <div className="mt-3 space-y-2">
                            {selectedLatestVersion.attachments.map((item, index) => (
                              <button key={`${item.url}-${index}`} type="button" onClick={() => resolveAndOpenAttachment_(item, apiRequest).catch((err) => setStatusMessage(String((err && err.message) || "附件開啟失敗")))} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-slate-300 hover:bg-white">
                                <span className="truncate">{item.name || item.url}</span>
                                <span className="text-xs text-slate-400">{attachmentActionLabel}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              ) : null}
            </div>

            {selectedDocument ? (
              <div className="card p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="section-title">版本歷史</h2>
                    <p className="mt-1 text-sm text-slate-500">平常先看最新內容；需要追版本時再展開。</p>
                  </div>
                  <button type="button" onClick={() => setShowVersionHistory((prev) => !prev)} className="btn-secondary">
                    {showVersionHistory ? `收合版本歷史` : `展開版本歷史（${versions.length}）`}
                  </button>
                </div>
                {showVersionHistory ? (
                  <div className="mt-4 space-y-3">
                    {versions.length ? versions.map((version) => {
                      const cleanVersionSummary = getCleanSummary_(version.summary);
                      const cleanVersionChange = getCleanSummary_(version.changeSummary);
                      return (
                        <div key={version.id} className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge">v{version.versionNumber}</span>
                            <span className="badge-muted">{formatDate(version.createdAt)}</span>
                            {version.createdByName ? <span className="badge-muted">{version.createdByName}</span> : null}
                          </div>
                          {cleanVersionChange ? <p className="mt-3 text-sm font-medium text-slate-800">{cleanVersionChange}</p> : null}
                          {cleanVersionSummary ? <p className="mt-2 text-sm text-slate-500">{cleanVersionSummary}</p> : null}
                          {(version.meetingDate || version.effectiveDate) ? (
                            <p className="mt-3 text-xs text-slate-400">
                              {version.meetingDate ? `會議日期：${version.meetingDate}` : ""}
                              {version.meetingDate && version.effectiveDate ? " ・ " : ""}
                              {version.effectiveDate ? `生效日：${version.effectiveDate}` : ""}
                            </p>
                          ) : null}
                        </div>
                      );
                    }) : <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">尚無版本歷史</div>}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
