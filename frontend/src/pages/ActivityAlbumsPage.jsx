import React, { useEffect, useRef, useState } from "react";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png"]);

function imageMime(file) {
  const supplied = String(file?.type || "").toLowerCase();
  if (ACCEPTED_TYPES.has(supplied)) return supplied;
  return /\.jpe?g$/i.test(file?.name || "") ? "image/jpeg" : /\.png$/i.test(file?.name || "") ? "image/png" : "";
}

function upload(url, file, mimeType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round(event.loaded / event.total * 100));
    xhr.onerror = () => reject(new Error("網路中斷，請重試"));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`檔案傳送失敗（${xhr.status}）`));
    xhr.send(file);
  });
}

export default function ActivityAlbumsPage({ shared }) {
  const { API_V2_URL, loadStoredAdminSession_ } = shared;
  const apiBase = String(API_V2_URL || "").replace(/\/$/, "");
  const inputRef = useRef(null);
  const touchStartXRef = useRef(null);
  const viewerRef = useRef(null);
  const viewerCloseRef = useRef(null);
  const viewerTriggerRef = useRef(null);
  const [albums, setAlbums] = useState([]);
  const [active, setActive] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [viewerIndex, setViewerIndex] = useState(null);
  const viewerOpen = viewerIndex !== null;
  const closeViewer = () => {
    setViewerIndex(null);
    window.requestAnimationFrame(() => viewerTriggerRef.current?.focus());
  };

  const request = async (path, options = {}) => {
    const session = loadStoredAdminSession_();
    const response = await fetch(`${apiBase}${path}`, { ...options, headers: { Authorization: `Bearer ${session?.token || ""}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new Error(body?.error || "操作失敗");
    return body.data;
  };
  const loadAlbums = async () => {
    try { const data = await request("/v1/activity-albums?includeArchived=1"); setAlbums(data.albums || []); setCanManage(Boolean(data.canManage)); } catch (cause) { setError(cause.message); }
  };
  const openAlbum = async (album) => {
    setError(""); setActive(album); setViewerIndex(null);
    try { const data = await request(`/v1/activity-albums/${album.id}/photos?includeHidden=1`); setActive(data.album); setPhotos(data.photos || []); setCanManage(Boolean(data.canManage)); } catch (cause) { setError(cause.message); }
  };
  useEffect(() => { loadAlbums(); }, []);
  useEffect(() => {
    if (!viewerOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") setViewerIndex((current) => current === null ? null : (current - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") setViewerIndex((current) => current === null ? null : (current + 1) % photos.length);
      if (event.key === "Tab") {
        const focusable = Array.from(viewerRef.current?.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") || []).filter((element) => !element.disabled);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    viewerCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [viewerOpen, photos.length]);
  const setUpload = (key, patch) => setUploads((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  const uploadOne = async (item) => {
    const mimeType = imageMime(item.file);
    if (!mimeType || item.file.size <= 0 || item.file.size > MAX_IMAGE_BYTES) return setUpload(item.key, { status: "failed", error: "僅支援 JPG、PNG，且每張不可超過 15 MB（HEIC／HEIF 暫不支援）" });
    setUpload(item.key, { status: "uploading", progress: 0, error: "" });
    try {
      const intent = await request(`/v1/activity-albums/${active.id}/upload-intent`, { method: "POST", body: JSON.stringify({ fileName: item.file.name, mimeType, sizeBytes: item.file.size }) });
      await upload(intent.signedUrl, item.file, mimeType, (progress) => setUpload(item.key, { progress }));
      await request(`/v1/activity-photos/${intent.photoId}/complete`, { method: "POST", body: "{}" });
      setUpload(item.key, { status: "done", progress: 100 });
    } catch (cause) { setUpload(item.key, { status: "failed", error: cause.message }); }
  };
  const enqueue = async (files) => {
    const items = Array.from(files || []).map((file) => ({ key: crypto.randomUUID(), file, progress: 0, status: "queued", error: "" }));
    setUploads((current) => [...current, ...items]);
    const queue = [...items];
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => { while (queue.length) await uploadOne(queue.shift()); }));
    if (active) await openAlbum(active); await loadAlbums();
  };
  const updatePhoto = async (photo, status) => { try { await request(`/v1/activity-photos/${photo.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await openAlbum(active); } catch (cause) { setError(cause.message); } };
  const download = async (photo) => { try { const { url } = await request(`/v1/activity-photos/${photo.id}/download`); window.open(url, "_blank", "noopener,noreferrer"); } catch (cause) { setError(cause.message); } };
  const showPreviousPhoto = () => setViewerIndex((current) => current === null ? null : (current - 1 + photos.length) % photos.length);
  const showNextPhoto = () => setViewerIndex((current) => current === null ? null : (current + 1) % photos.length);
  const createAlbum = async () => { const title = window.prompt("活動名稱"); if (!title) return; try { const { album } = await request("/v1/activity-albums", { method: "POST", body: JSON.stringify({ title }) }); await loadAlbums(); await openAlbum(album); } catch (cause) { setError(cause.message); } };
  const visible = albums.filter((album) => album.title.toLowerCase().includes(search.trim().toLowerCase()));

  return <main className="min-h-screen bg-slate-50 px-4 py-7 sm:px-10"><div className="mx-auto max-w-6xl">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-[.25em] text-cyan-600">115B MEMORIES</p><h1 className="mt-2 text-3xl font-bold text-slate-900">活動相簿</h1></div><div className="flex flex-wrap justify-end gap-2"><a href="/" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">回首頁</a>{canManage && <button onClick={createAlbum} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">＋ 建立相簿</button>}</div></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <label className="mt-6 block max-w-md text-sm text-slate-600">搜尋活動名稱<input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
    <div className="mt-4 flex flex-wrap gap-2">{visible.map((album) => <button key={album.id} onClick={() => openAlbum(album)} className="flex w-40 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-cyan-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">{album.coverUrl && <img src={album.coverUrl} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />}<div className="min-w-0"><h2 className="truncate text-sm font-semibold text-slate-900">{album.title}</h2><p className="mt-0.5 truncate text-xs text-slate-500">{[album.eventDate?.replaceAll("-", "/"), `${album.photoCount} 張`].filter(Boolean).join(" · ")}</p></div></button>)}</div>
    {active && <section className="mt-10 rounded-3xl bg-white p-4 shadow-sm sm:p-6"><button onClick={() => { setActive(null); setPhotos([]); setViewerIndex(null); }} className="text-sm font-medium text-cyan-700">← 所有相簿</button><div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-slate-900">{active.title}</h2><p className="text-sm text-slate-500">{[active.eventDate?.replaceAll("-", "/"), active.location].filter(Boolean).join(" · ")}</p></div>{active.status === "active" && <><button onClick={() => inputRef.current?.click()} className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">上傳 JPG / PNG</button><input ref={inputRef} hidden multiple accept="image/jpeg,image/png,.jpg,.jpeg,.png" type="file" onChange={(event) => { enqueue(event.target.files); event.target.value = ""; }} /></>}</div>
      {canManage && <p className="mt-3 text-xs text-slate-500">「從相簿隱藏」會讓一般同學看不到這張照片，但不會刪除檔案；管理者仍可查看並還原。</p>}
      {uploads.length > 0 && <div className="mt-5 rounded-2xl bg-slate-50 p-4">{uploads.map((item) => <div key={item.key} className="mb-2 text-sm"><span>{item.file.name} — {item.status === "done" ? "已完成" : item.status === "failed" ? item.error : `${item.progress}%`}</span>{item.status === "uploading" && <div className="mt-1 h-1.5 rounded bg-slate-200"><div className="h-full bg-cyan-500" style={{ width: `${item.progress}%` }} /></div>}</div>)}</div>}
      {!photos.length ? <p className="py-10 text-center text-sm text-slate-500">尚無可瀏覽的照片。</p> : <div className="mt-6 columns-2 gap-3 sm:columns-3 lg:columns-4">{photos.map((photo, index) => <article key={photo.id} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-xl bg-slate-100"><button type="button" onClick={(event) => { viewerTriggerRef.current = event.currentTarget; setViewerIndex(index); }} className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500" aria-label={`瀏覽照片 ${index + 1}：${photo.originalName}`}><img src={photo.signedUrl} alt={photo.originalName} className="w-full transition duration-200 group-hover:scale-[1.02]" loading="lazy" /></button>{photo.status === "hidden" && <span className="pointer-events-none absolute left-2 top-2 rounded bg-slate-900/75 px-2 py-1 text-xs text-white">一般同學看不到</span>}<div className="absolute inset-x-0 bottom-0 flex gap-1 bg-slate-950/70 p-2 text-xs text-white"><button onClick={() => download(photo)} className="rounded bg-white/20 px-2 py-1 hover:bg-white/30">下載</button>{canManage && <button onClick={() => updatePhoto(photo, photo.status === "hidden" ? "ready" : "hidden")} className="rounded bg-white/20 px-2 py-1 hover:bg-white/30">{photo.status === "hidden" ? "還原顯示" : "從相簿隱藏"}</button>}</div></article>)}</div>}
    </section>}
    {viewerIndex !== null && photos[viewerIndex] && <div ref={viewerRef} role="dialog" aria-modal="true" aria-label="照片瀏覽器" className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 text-white" onTouchStart={(event) => { touchStartXRef.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = touchStartXRef.current; const end = event.changedTouches[0]?.clientX; touchStartXRef.current = null; if (start === null || end === undefined) return; if (start - end > 50) showNextPhoto(); if (end - start > 50) showPreviousPhoto(); }}>
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6"><p className="min-w-0 truncate text-sm text-slate-200"><span className="font-semibold text-white">{viewerIndex + 1} / {photos.length}</span><span className="ml-3 hidden sm:inline">{photos[viewerIndex].originalName}</span>{photos[viewerIndex].status === "hidden" && <span className="ml-3 rounded-full bg-amber-400/20 px-2 py-1 text-xs text-amber-200">一般同學看不到</span>}</p><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => download(photos[viewerIndex])} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">下載</button><button ref={viewerCloseRef} type="button" onClick={closeViewer} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="關閉照片瀏覽器">×</button></div></div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-4 sm:px-24"><img src={photos[viewerIndex].signedUrl} alt={photos[viewerIndex].originalName} className="max-h-full max-w-full select-none object-contain" />{photos.length > 1 && <><button type="button" onClick={showPreviousPhoto} className="absolute left-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-3xl hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-6" aria-label="上一張照片">‹</button><button type="button" onClick={showNextPhoto} className="absolute right-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-3xl hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6" aria-label="下一張照片">›</button></>}
      </div>
      <p className="pb-4 text-center text-xs text-slate-400">左右滑動或使用方向鍵切換照片</p>
    </div>}
  </div></main>;
}
