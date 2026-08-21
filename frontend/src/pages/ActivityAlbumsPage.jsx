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
  const [albums, setAlbums] = useState([]);
  const [active, setActive] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
    setError(""); setActive(album);
    try { const data = await request(`/v1/activity-albums/${album.id}/photos?includeHidden=1`); setActive(data.album); setPhotos(data.photos || []); setCanManage(Boolean(data.canManage)); } catch (cause) { setError(cause.message); }
  };
  useEffect(() => { loadAlbums(); }, []);
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
  const createAlbum = async () => { const title = window.prompt("活動名稱"); if (!title) return; try { const { album } = await request("/v1/activity-albums", { method: "POST", body: JSON.stringify({ title }) }); await loadAlbums(); await openAlbum(album); } catch (cause) { setError(cause.message); } };
  const visible = albums.filter((album) => album.title.toLowerCase().includes(search.trim().toLowerCase()));

  return <main className="min-h-screen bg-slate-50 px-4 py-7 sm:px-10"><div className="mx-auto max-w-6xl">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-[.25em] text-cyan-600">115B MEMORIES</p><h1 className="mt-2 text-3xl font-bold text-slate-900">活動相簿</h1></div>{canManage && <button onClick={createAlbum} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">＋ 建立相簿</button>}</div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <label className="mt-6 block max-w-md text-sm text-slate-600">搜尋活動名稱<input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" /></label>
    <div className="mt-4 flex flex-wrap gap-2">{visible.map((album) => <button key={album.id} onClick={() => openAlbum(album)} className="flex w-40 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-cyan-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">{album.coverUrl && <img src={album.coverUrl} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />}<div className="min-w-0"><h2 className="truncate text-sm font-semibold text-slate-900">{album.title}</h2><p className="mt-0.5 truncate text-xs text-slate-500">{[album.eventDate?.replaceAll("-", "/"), `${album.photoCount} 張`].filter(Boolean).join(" · ")}</p></div></button>)}</div>
    {active && <section className="mt-10 rounded-3xl bg-white p-4 shadow-sm sm:p-6"><button onClick={() => { setActive(null); setPhotos([]); }} className="text-sm font-medium text-cyan-700">← 所有相簿</button><div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-slate-900">{active.title}</h2><p className="text-sm text-slate-500">{[active.eventDate?.replaceAll("-", "/"), active.location].filter(Boolean).join(" · ")}</p></div>{active.status === "active" && <><button onClick={() => inputRef.current?.click()} className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">上傳 JPG / PNG</button><input ref={inputRef} hidden multiple accept="image/jpeg,image/png,.jpg,.jpeg,.png" type="file" onChange={(event) => { enqueue(event.target.files); event.target.value = ""; }} /></>}</div>
      {uploads.length > 0 && <div className="mt-5 rounded-2xl bg-slate-50 p-4">{uploads.map((item) => <div key={item.key} className="mb-2 text-sm"><span>{item.file.name} — {item.status === "done" ? "已完成" : item.status === "failed" ? item.error : `${item.progress}%`}</span>{item.status === "uploading" && <div className="mt-1 h-1.5 rounded bg-slate-200"><div className="h-full bg-cyan-500" style={{ width: `${item.progress}%` }} /></div>}</div>)}</div>}
      {!photos.length ? <p className="py-10 text-center text-sm text-slate-500">尚無可瀏覽的照片。</p> : <div className="mt-6 columns-2 gap-3 sm:columns-3 lg:columns-4">{photos.map((photo) => <article key={photo.id} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-xl bg-slate-100"><img src={photo.signedUrl} alt={photo.originalName} className="w-full" loading="lazy" />{photo.status === "hidden" && <span className="absolute left-2 top-2 rounded bg-slate-900/75 px-2 py-1 text-xs text-white">已隱藏</span>}<div className="absolute inset-x-0 bottom-0 flex gap-1 bg-slate-950/70 p-2 text-xs text-white"><button onClick={() => download(photo)} className="rounded bg-white/20 px-2 py-1">下載</button>{canManage && <button onClick={() => updatePhoto(photo, photo.status === "hidden" ? "ready" : "hidden")} className="rounded bg-white/20 px-2 py-1">{photo.status === "hidden" ? "還原" : "隱藏"}</button>}</div></article>)}</div>}
    </section>}
  </div></main>;
}
