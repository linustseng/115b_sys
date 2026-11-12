import React, { useEffect, useRef, useState } from "react";

// Signed URLs are short-lived. Retry once with a freshly authorized URL,
// never loop indefinitely for deleted files or a persistent network failure.
export default function AlbumPhotoImage({ photo, refreshUrl, className, loading, onOpen, label }) {
  const [revision, setRevision] = useState(0);
  const [src, setSrc] = useState(photo.signedUrl);
  const [state, setState] = useState("loading");
  const host = useRef(null);
  const attempts = useRef(0);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    attempts.current = 0;
    setSrc(photo.signedUrl); setState("loading");
    return () => { generation.current++; };
  }, [photo.id, photo.signedUrl]);
  const retry = async (manual = false, initial = false) => {
    if (!manual && attempts.current >= 1) { setState("failed"); return; }
    if (!initial) attempts.current++;
    const current = generation.current;
    setState("refreshing");
    try {
      const url = await refreshUrl(photo);
      if (current !== generation.current) return;
      setSrc(url); setRevision(value => value + 1); setState("loading");
    } catch {
      if (current === generation.current) setState("failed");
    }
  };
  useEffect(() => {
    if (photo.signedUrl) return;
    let started = false;
    const start = () => { if (!started) { started = true; retry(false, true); } };
    if (loading !== "lazy" || !window.IntersectionObserver) { start(); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, { rootMargin: "200px" });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [photo.id, photo.signedUrl, loading]);
  const image = src ? <img key={revision} src={src} alt={photo.originalName} className={className} loading={loading}
    onLoad={() => setState("ready")} onError={() => retry()}
    style={state === "failed" ? { display: "none" } : undefined} decoding="async" /> : <div className="min-h-32" aria-label="等待載入照片" />;
  return <div ref={host} className={onOpen ? "min-h-32" : "contents"}>
    {onOpen ? <button type="button" onClick={onOpen} aria-label={label} className="block w-full cursor-zoom-in">{image}</button> : image}
    {state === "refreshing" && <span role="status" className="block p-4 text-center text-sm">正在重新載入照片…</span>}
    {state === "failed" && <div className="min-h-32 p-4 pb-14 text-center text-sm"><p>照片載入失敗</p><button type="button" onClick={() => retry(true)} className="mt-2 rounded-full border px-4 py-2">重試照片</button></div>}
  </div>;
}
