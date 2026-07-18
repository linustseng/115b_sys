import React, { useEffect, useRef, useState } from "react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function CheerleadingVideoPreviewPage({ shared }) {
  const request = shared.authedApiRequest || shared.apiRequest;
  const videoRef = useRef(null);
  const shellRef = useRef(null);
  const [videos, setVideos] = useState([]);
  const [active, setActive] = useState(null);
  const [url, setUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    request({ action: "getCheerleadingVideoPreview" })
      .then(({ result }) => {
        if (!result?.ok) throw new Error(result?.error || "無權限");
        setVideos(result.data?.videos || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const enterFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell?.requestFullscreen || document.fullscreenElement === shell) return;
    try { await shell.requestFullscreen(); } catch { /* Browser may deny fullscreen outside a user gesture. */ }
  };

  const exitFullscreen = async () => {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
  };

  const open = async (video) => {
    try {
      setError("");
      const { result } = await request({ action: "getCheerleadingVideoPreviewPlayback", data: { videoId: video.id } });
      if (!result?.ok) throw new Error(result?.error || "播放失敗");
      setActive(video);
      setUrl(result.data.url);
      setProgress(0);
      setPlaying(false);
    } catch (e) { setError(e.message); }
  };

  const startPlayback = async () => {
    const v = videoRef.current;
    if (!v) return;
    await enterFullscreen();
    try { await v.play(); } catch (e) { setError(e.message || "無法播放影片"); }
  };

  const toggle = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) await startPlayback(); else v.pause();
  };

  const changeSpeed = (nextSpeed) => {
    setSpeed(nextSpeed);
    if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
  };

  const format = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, "0")}`;
  const watermarkPosition = ["left-3 top-3", "right-3 top-3", "bottom-16 left-3", "bottom-16 right-3"][Math.floor(tick / 15000) % 4];

  return <>
    <style>{`.cheer-video-shell{height:clamp(18rem,58dvh,36rem)}.cheer-video-shell video{width:100%;height:100%;object-fit:contain}.cheer-video-shell:fullscreen,.cheer-video-shell:-webkit-full-screen{width:100vw;height:100dvh;border-radius:0}.cheer-video-shell:fullscreen video,.cheer-video-shell:-webkit-full-screen video{width:100%;height:100%;object-fit:contain}`}</style>
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold">啦啦隊影片 · 自製播放器預覽</h1>
        <p className="text-sm text-slate-400">僅 Linus 測試；播放會嘗試直接進入全螢幕，浮水印會保留。</p>
        {error ? <p className="rounded-xl bg-rose-950 p-3 text-rose-200">{error}</p> : null}
        <div className="flex flex-wrap gap-2">{videos.map((v) => <button key={v.id} onClick={() => open(v)} className="rounded-full bg-slate-800 px-4 py-2 text-sm hover:bg-pink-600">{v.title}</button>)}</div>
        {url ? <div ref={shellRef} className="cheer-video-shell relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} src={url} playsInline onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)} onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); e.currentTarget.playbackRate = speed; }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className="w-full" />
          <div className={`pointer-events-none absolute z-10 rounded bg-black/45 px-2 py-1 text-xs font-semibold ${watermarkPosition}`}>Linus Tseng · {new Date(tick).toLocaleString("zh-TW", { hour12: false })}</div>
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center gap-3 bg-black/75 p-3">
            <button onClick={toggle} className="rounded bg-white px-3 py-1 text-sm font-bold text-black">{playing ? "暫停" : "播放並全螢幕"}</button>
            <input aria-label="播放進度" type="range" min="0" max={duration || 0} value={progress} onChange={(e) => { const v = videoRef.current; if (v) v.currentTime = Number(e.target.value); setProgress(Number(e.target.value)); }} className="min-w-24 flex-1" />
            <span className="text-xs">{format(progress)} / {format(duration)}</span>
            <select aria-label="播放速度" value={speed} onChange={(e) => changeSpeed(Number(e.target.value))} className="rounded border border-white/60 bg-black px-2 py-1 text-sm">{SPEEDS.map((value) => <option key={value} value={value}>{value}x</option>)}</select>
            {isFullscreen ? <button onClick={exitFullscreen} className="rounded border border-white/60 px-3 py-1 text-sm">退出全螢幕</button> : <button onClick={enterFullscreen} className="rounded border border-white/60 px-3 py-1 text-sm">全螢幕</button>}
          </div>
        </div> : null}
      </div>
    </main>
  </>;
}
