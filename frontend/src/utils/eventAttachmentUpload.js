const TYPES = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export async function uploadEventAttachment({ file, eventId, baseUrl, sessionToken, idToken, timeoutMs = 90000 }) {
  if (!eventId) throw new Error('請先設定活動日期，產生活動 ID 後再上傳');
  if (!baseUrl) throw new Error('附件服務尚未設定');
  if (file.size > 10 * 1024 * 1024) throw new Error('檔案超過 10MB 上限');
  const mime = TYPES[file.name.split('.').pop().toLowerCase()];
  if (!mime) throw new Error('檔案格式不支援');
  if (!sessionToken && !idToken) throw new Error('登入已失效，請重新登入後再上傳');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = new FormData();
    body.append('file', new Blob([file], { type: mime }), file.name);
    body.append('entityType', 'event');
    body.append('entityId', eventId);
    body.append('attachmentKind', 'reference');
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/attachments/upload`, {
      method: 'POST', body, signal: controller.signal,
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : { 'x-id-token': idToken },
    });
    if (response.status === 401) throw new Error('登入已失效，請重新登入後再上傳');
    if (response.status === 403) throw new Error('沒有上傳活動附件的權限');
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || `上傳失敗 (HTTP ${response.status})`);
    const item = payload.data?.item;
    if (!item?.attachmentId || !item?.url) throw new Error('上傳回應不完整，請重新確認附件');
    return item;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('上傳逾時，請檢查網路後再試');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
