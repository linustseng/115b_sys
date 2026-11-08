import React, { useEffect, useRef, useState } from "react";

// Signed URLs are short-lived. Retry once with a freshly authorized URL,
// never loop indefinitely for deleted files or a persistent network failure.
export default function AlbumPhotoImage({ photo, refreshUrl, className, loading, onOpen, label }) {
  const [revision, setRevision] = useState(0);
  const [src, setSrc] = useState(photo.signedUrl);
  const [state, setState] = useState("loading");
  const attempts = useRef(0);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    attempts.current = 0;
    setSrc(photo.signedUrl); setState("loading");
    return () => { generation.current++; };
  }, [photo.id, photo.signedUrl]);
  const retry = async (manual = false) => {
    if (!manual && attempts.current >= 1) { setState("failed"); return; }
    attempts.current++;
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
  const image = <img key={revision} src={src} alt={photo.originalName} className={className} loading={loading}
    onLoad={() => setState("ready")} onError={() => retry()}
    style={state === "failed" ? { display: "none" } : undefined} />;
  return <>
    {onOpen ? <button type="button" onClick={onOpen} aria-label={label} className="block w-full cursor-zoom-in">{image}</button> : image}
    {state === "refreshing" && <span role="status" className="block p-4 text-center text-sm">正在重新載入照片…</span>}
    {state === "failed" && <div className="min-h-32 p-4 pb-14 text-center text-sm"><p>照片載入失敗</p><button type="button" onClick={() => retry(true)} className="mt-2 rounded-full border px-4 py-2">重試照片</button></div>}
  </>;
}
