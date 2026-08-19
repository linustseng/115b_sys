import React, { useEffect, useRef, useState } from "react";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"]);

function imageMimeForFile(file) {
  const supplied = String(file && file.type || "").trim().toLowerCase();
  if (ACCEPTED_MIMES.has(supplied)) return supplied;
  const name = String(file && file.name || "").toLowerCase();
  if (/\.(jpe?g)$/.test(name)) return "image/jpeg";
  if (/\.png$/.test(name)) return "image/png";
  if (/\.heic$/.test(name)) return "image/heic";
  if (/\.heif$/.test(name)) return "image/heif";
  return "";
}

function formatDate(value) {
  if (!value) return "未設定日期";
  return String(value).replaceAll("-", "/");
}

function uploadWithProgress(url, file, mimeType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    xhr.onerror = () => reject(new Error("網路中斷，請重試"));
    xhr.onabort = () => reject(new Error("上傳已取消"));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`檔案傳送失敗（${xhr.status || "未知狀態"}）`));
    xhr.send(file);
  });
}

export default function ActivityAlbumsPage({ shared }) {
  const { API_V2_URL, loadStoredAdminSession_ } = shared;
  const apiBase = String(API_V2_URL || "").replace(/\/$/, "");
  const inputRef = useRef(null);
  const [albums, setAlbums] = useState([]);
  const [active, setActive] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [uploads, setUploads] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [albumSearch, setAlbumSearch] = useState("");
  const [photoDate, setPhotoDate] = useState("");
  const [photoUploader, setPhotoUploader] = useState("");
  const [albumForm, setAlbumForm] = useState({ title: "", description: "", eventDate: "", location: "", status: "active", coverPhotoId: "" });

  const request = async (path, options = {}) => {
    if (!apiBase) throw new Error("活動相簿 API 尚未設定");
    const session = loadStoredAdminSession_();
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.token || ""}`, ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || !body.ok) throw new Error(body?.error || "操作失敗");
    return body.data;
  };

  const loadAlbums = async () => {
    try {
      const data = await request("/v1/activity-albums?includeArchived=1");
      setAlbums(data.albums || []);
      setCanManage(Boolean(data.canManage));
    } catch (cause) { setError(cause.message); }
  };

  const setActiveAlbum = (album) => {
    setActive(album);
    setAlbumForm({
      title: album.title || "", description: album.description || "", eventDate: album.event_date || "",
      location: album.location || "", status: album.status || "active", coverPhotoId: album.cover_photo_id || "",
    });
  };

  const openAlbum = async (album) => {
    setError("");
    setActiveAlbum(album);
    try {
      const data = await request(`/v1/activity-albums/${album.id}/photos?includeHidden=1`);
      setPhotos(data.photos || []);
      setCanManage(Boolean(data.canManage));
      if (data.album) setActiveAlbum(data.album);
    } catch (cause) { setError(cause.message); }
  };

  const normalizedSearch = albumSearch.trim().toLowerCase();
  const visibleAlbums = albums.filter((album) => !normalizedSearch || String(album.title || "").toLowerCase().includes(normalizedSearch));
  const uploaderOptions = [...new Set(photos.map((photo) => photo.uploaded_by_name).filter(Boolean))];
  const visiblePhotos = photos.filter((photo) => {
    const photoDay = String(photo.captured_at || photo.created_at || "").slice(0, 10);
    return (!photoDate || photoDay === photoDate) && (!photoUploader || photo.uploaded_by_name === photoUploader);
  });

  useEffect(() => { loadAlbums(); }, []);
  useEffect(() => {
    if (viewerIndex < 0) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setViewerIndex(-1);
      if (event.key === "ArrowLeft") setViewerIndex((index) => Math.max(0, index - 1));
      if (event.key === "ArrowRight") setViewerIndex((index) => Math.min(visiblePhotos.length - 1, index + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerIndex, visiblePhotos.length]);

  const updateUpload = (key, changes) => setUploads((items) => items.map((item) => item.key === key ? { ...item, ...changes } : item));

  const uploadOne = async (item) => {
    if (!active) return;
    const mimeType = imageMimeForFile(item.file);
    if (!mimeType || item.file.size > MAX_IMAGE_BYTES || item.file.size <= 0) {
      updateUpload(item.key, { status: "failed", error: "僅支援 JPG、PNG、HEIC／HEIF，且每張不可超過 15 MB" });
      return;
    }
    updateUpload(item.key, { status: "uploading", progress: 0, error: "" });
    try {
      const intent = await request(`/v1/activity-albums/${active.id}/upload-intent`, {
        method: "POST", body: JSON.stringify({ fileName: item.file.name, mimeType, sizeBytes: item.file.size }),
      });
      await uploadWithProgress(intent.signedUrl, item.file, mimeType, (progress) => updateUpload(item.key, { progress }));
      await request(`/v1/activity-photos/${intent.photoId}/complete`, { method: "POST", body: "{}" });
      updateUpload(item.key, { status: "done", progress: 100 });
    } catch (cause) {
      updateUpload(item.key, { status: "failed", error: cause.message });
    }
  };

  const runUploadQueue = async (items) => {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) await uploadOne(queue.shift());
    });
    await Promise.all(workers);
    if (active) await openAlbum(active);
    await loadAlbums();
  };

  const selectFiles = (fileList) => {
    const items = Array.from(fileList || []).map((file) => ({ key: `${Date.now()}-${crypto.randomUUID()}`, file, progress: 0, status: "queued", error: "" }));
    if (!items.length) return;
    setUploads((current) => [...current, ...items]);
    runUploadQueue(items);
  };

  const retryUpload = (item) => runUploadQueue([item]);

  const createAlbum = async () => {
    const title = window.prompt("活動名稱");
    if (!title) return;
    try {
      const { album } = await request("/v1/activity-albums", { method: "POST", body: JSON.stringify({ title }) });
      await loadAlbums();
      await openAlbum(album);
    } catch (cause) { setError(cause.message); }
  };

  const saveAlbum = async (event) => {
    event.preventDefault();
    if (!active) return;
    try {
      const { album } = await request(`/v1/activity-albums/${active.id}`, { method: "PATCH", body: JSON.stringify(albumForm) });
      setActiveAlbum(album);
      await loadAlbums();
    } catch (cause) { setError(cause.message); }
  };

  const updatePhoto = async (photo, status) => {
    try {
      await request(`/v1/activity-photos/${photo.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await openAlbum(active);
      await loadAlbums();
    } catch (cause) { setError(cause.message); }
  };

  const deletePhoto = async (photo) => {
    if (!window.confirm(`永久刪除「${photo.original_name}」？`)) return;
    try {
      await request(`/v1/activity-photos/${photo.id}`, { method: "DELETE" });
      await openAlbum(active);
      await loadAlbums();
    } catch (cause) { setError(cause.message); }
  };

  const downloadPhoto = async (photo) => {
    try {
      const { url } = await request(`/v1/activity-photos/${photo.id}/download`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) { setError(cause.message); }
  };

  const viewerPhoto = visiblePhotos[viewerIndex];
  const completeCount = uploads.filter((item) => item.status === "done").length;

  return <main className="min-h-screen bg-slate-50 px-4 py-7 sm:px-10"><div className="mx-auto max-w-6xl">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-[.25em] text-cyan-600">115B MEMORIES</p><h1 className="mt-2 text-3xl font-bold text-slate-900">活動相簿</h1></div>{canManage && <button onClick={createAlbum} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">＋ 建立相簿</button>}</div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!albums.length && <p className="mt-8 rounded-3xl bg-white p-8 text-center text-slate-500">目前還沒有可瀏覽的活動相簿。</p>}
    <label className="mt-6 block max-w-md text-sm text-slate-600">搜尋活動名稱<input value={albumSearch} onChange={(event) => setAlbumSearch(event.target.value)} placeholder="例如：春酒、個案課" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleAlbums.map((album) => <button key={album.id} onClick={() => openAlbum(album)} className="overflow-hidden rounded-3xl bg-white text-left shadow-sm transition hover:shadow-md"><div className="aspect-[4/3] bg-gradient-to-br from-cyan-100 to-indigo-100">{album.cover_url && <img src={album.cover_url} alt="" className="h-full w-full object-cover" />}</div><div className="p-5"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold text-slate-900">{album.title}</h2>{album.status === "archived" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">封存</span>}</div><p className="mt-1 text-sm text-slate-500">{formatDate(album.event_date)} · {album.photo_count} 張</p></div></button>)}</div>
    {active && <section className="mt-10 rounded-3xl bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><button onClick={() => { setActive(null); setPhotos([]); }} className="text-sm font-medium text-cyan-700">← 所有相簿</button><h2 className="mt-2 text-2xl font-bold text-slate-900">{active.title}</h2><p className="mt-1 text-sm text-slate-500">{[formatDate(active.event_date), active.location].filter(Boolean).join(" · ")}</p></div>{active.status === "active" && <><button onClick={() => inputRef.current?.click()} className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">上傳照片</button><input ref={inputRef} hidden multiple accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" type="file" onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} /></>}</div>
      {uploads.length > 0 && <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-700">上傳進度：{completeCount} / {uploads.length}</p><div className="mt-3 space-y-2">{uploads.map((item) => <div key={item.key} className="text-sm"><div className="flex items-center justify-between gap-2"><span className="truncate text-slate-700">{item.file.name}</span><span className={item.status === "failed" ? "text-rose-600" : "text-slate-500"}>{item.status === "done" ? "已完成" : item.status === "failed" ? "失敗" : `${item.progress}%`}</span></div>{item.status === "uploading" && <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200"><div className="h-full bg-cyan-500" style={{ width: `${item.progress}%` }} /></div>}{item.status === "failed" && <div className="mt-1 flex items-center gap-2 text-xs text-rose-600"><span>{item.error}</span><button onClick={() => retryUpload(item)} className="font-semibold underline">重試</button></div>}</div>)}</div></div>}
      {photos.length > 0 && <div className="mt-5 flex flex-wrap gap-3"><label className="text-sm text-slate-600">日期<input type="date" value={photoDate} onChange={(event) => setPhotoDate(event.target.value)} className="ml-2 rounded-lg border border-slate-200 px-2 py-1" /></label><label className="text-sm text-slate-600">上傳者<select value={photoUploader} onChange={(event) => setPhotoUploader(event.target.value)} className="ml-2 rounded-lg border border-slate-200 px-2 py-1"><option value="">全部</option>{uploaderOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label></div>}
      {!photos.length ? <p className="py-10 text-center text-sm text-slate-500">尚無照片，從手機或電腦上傳第一張吧。</p> : !visiblePhotos.length ? <p className="py-10 text-center text-sm text-slate-500">沒有符合篩選條件的照片。</p> : <div className="mt-6 columns-2 gap-3 sm:columns-3 lg:columns-4">{visiblePhotos.map((photo, index) => <article key={photo.id} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-xl bg-slate-100"><button onClick={() => setViewerIndex(index)} className="block w-full"><img src={photo.signed_url} className="w-full" alt={photo.original_name} loading="lazy" /></button>{photo.status === "hidden" && <span className="absolute left-2 top-2 rounded bg-slate-900/75 px-2 py-1 text-xs text-white">已隱藏</span>}{canManage && <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-slate-950/70 p-2 text-xs text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100">{photo.status === "ready" && <button onClick={() => setAlbumForm((form) => ({ ...form, coverPhotoId: photo.id }))} className="rounded bg-white/20 px-2 py-1">設封面</button>}<button onClick={() => updatePhoto(photo, photo.status === "hidden" ? "ready" : "hidden")} className="rounded bg-white/20 px-2 py-1">{photo.status === "hidden" ? "還原" : "隱藏"}</button><button onClick={() => deletePhoto(photo)} className="rounded bg-rose-600 px-2 py-1">刪除</button></div>}</article>)}</div>}
      {canManage && <form onSubmit={saveAlbum} className="mt-8 border-t border-slate-100 pt-6"><h3 className="font-bold text-slate-900">相簿設定</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">名稱<input required value={albumForm.title} onChange={(event) => setAlbumForm({ ...albumForm, title: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm">活動日期<input type="date" value={albumForm.eventDate} onChange={(event) => setAlbumForm({ ...albumForm, eventDate: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm">地點<input value={albumForm.location} onChange={(event) => setAlbumForm({ ...albumForm, location: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm">狀態<select value={albumForm.status} onChange={(event) => setAlbumForm({ ...albumForm, status: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="active">進行中</option><option value="archived">已結束／封存</option></select></label><label className="text-sm sm:col-span-2">封面<select value={albumForm.coverPhotoId} onChange={(event) => setAlbumForm({ ...albumForm, coverPhotoId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option value="">未設定</option>{photos.filter((photo) => photo.status === "ready").map((photo) => <option key={photo.id} value={photo.id}>{photo.original_name}</option>)}</select></label><label className="text-sm sm:col-span-2">說明<textarea value={albumForm.description} onChange={(event) => setAlbumForm({ ...albumForm, description: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2" /></label></div><button className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">儲存相簿設定</button></form>}
    </section>}
  </div>{viewerPhoto && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-3"><button onClick={() => setViewerIndex(-1)} className="absolute right-4 top-4 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">關閉</button><button disabled={viewerIndex === 0} onClick={() => setViewerIndex((index) => index - 1)} className="absolute left-2 rounded-full bg-white/15 px-4 py-3 text-2xl text-white disabled:opacity-30">‹</button><img src={viewerPhoto.signed_url} alt={viewerPhoto.original_name} className="max-h-[88vh] max-w-[90vw] object-contain" /><button disabled={viewerIndex >= visiblePhotos.length - 1} onClick={() => setViewerIndex((index) => index + 1)} className="absolute right-2 rounded-full bg-white/15 px-4 py-3 text-2xl text-white disabled:opacity-30">›</button><div className="absolute bottom-4 flex items-center gap-3 text-sm text-white"><span>{viewerIndex + 1} / {visiblePhotos.length}</span><button onClick={() => downloadPhoto(viewerPhoto)} className="rounded-full bg-white px-4 py-2 font-semibold text-slate-900">下載</button></div></div>}</main>;
}
