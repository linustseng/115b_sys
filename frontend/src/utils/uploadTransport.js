// Keep the deadline active through response-body reading, not just HTTP headers.
export async function fetchUploadResponse(url, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('上傳服務回應逾時，請檢查附件是否已完成後再重試'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([(async () => {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const payload = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, json: async () => payload };
    })(), timeout]);
  } finally { clearTimeout(timer); }
}

// A large video can keep transferring for longer than a small document.
// Only lack of byte progress (including waiting for the final response) times out.
export function uploadSignedFile(url, file, mimeType, onProgress, idleMs = 90000) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let timer, settled = false, lastLoaded = 0;
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        finish(new Error('檔案傳送已停滯，請檢查網路後重試'));
        xhr.abort();
      }, idleMs);
    };
    try {
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', mimeType);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = event => {
        if (settled) return;
        if (event.loaded > lastLoaded) { lastLoaded = event.loaded; arm(); }
        if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
      };
      xhr.onerror = () => finish(new Error('檔案傳送中斷，請確認網路後重試'));
      xhr.onabort = () => finish(new Error('檔案上傳已取消'));
      xhr.ontimeout = () => finish(new Error('檔案傳送逾時，請重試'));
      xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? null : new Error(`檔案傳送失敗（${xhr.status || '無回應'}）`));
      arm(); xhr.send(file);
    } catch (error) { finish(error); }
  });
}
