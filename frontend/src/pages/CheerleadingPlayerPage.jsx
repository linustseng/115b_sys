import React, { useEffect, useMemo, useRef, useState } from "react";

const VIDEO_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function CheerleadingPlayerPage({ shared }) {
  const { apiRequest, authedApiRequest } = shared;
  const effectiveApiRequest = typeof authedApiRequest === "function" ? authedApiRequest : apiRequest;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [student, setStudent] = useState(null);
  const [practices, setPractices] = useState([]);
  const [fields, setFields] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [videos, setVideos] = useState([]);
  const [config, setConfig] = useState({});
  const [playingVideo, setPlayingVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [watermarkTick, setWatermarkTick] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState("attendance");
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [audioError, setAudioError] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const videoShellRef = useRef(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [videoFullscreen, setVideoFullscreen] = useState(false);

  const OPTIONS = [
    { value: "attend", label: "會到", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    { value: "late", label: "會遲到", tone: "border-amber-200 bg-amber-50 text-amber-700" },
    { value: "early_leave", label: "會早退", tone: "border-orange-200 bg-orange-50 text-orange-700" },
    { value: "absent", label: "無法到", tone: "border-rose-200 bg-rose-50 text-rose-700" },
    { value: "unknown", label: "未回覆", tone: "border-slate-200 bg-slate-50 text-slate-600" },
  ];
  const PRESENT = new Set(["attend", "late", "early_leave"]);
  const labelByStatus = OPTIONS.reduce((acc, item) => ({ ...acc, [item.value]: item.label }), {});
  const normalizeId = (value) => String(value || "").trim();
  const normalizeStatus = (value) => {
    const raw = String(value || "").trim();
    const status = raw === "excused" ? "absent" : raw;
    return OPTIONS.some((item) => item.value === status) ? status : "unknown";
  };
  const pad2 = (value) => String(value).padStart(2, "0");
  const getDateParts = (value) => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  };
  const formatDate = (value) => {
    const parts = getDateParts(value);
    if (!parts) return "未定日期";
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date(parts.year, parts.month - 1, parts.day).getDay()];
    return `${parts.year}/${pad2(parts.month)}/${pad2(parts.day)} (週${weekday})`;
  };
  const formatPracticeSchedule = (practice) => {
    const dateLabel = formatDate(practice?.date || practice?.startAt);
    const start = String(practice?.startAt || "").match(/(\d{1,2}:\d{2})/)?.[1] || "";
    const end = String(practice?.endAt || "").match(/(\d{1,2}:\d{2})/)?.[1] || "";
    return [dateLabel, start || end ? `${start || "-"}–${end || "-"}` : ""].filter(Boolean).join(" ");
  };
  const getName = (row) => String(row?.nameZh || row?.preferredName || row?.nameEn || row?.email || row?.id || "同學").trim();
  const normalizeTrackUrl = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    return /^https?:\/\//i.test(text) || text.startsWith("/") ? text : `/${text.replace(/^\/+/, "")}`;
  };
  const playlist = useMemo(() => (Array.isArray(config?.cheerPlaylist) ? config.cheerPlaylist : []).map((track, index) => {
    const url = normalizeTrackUrl(track?.url || track?.audioUrl);
    return url ? { id: String(track?.id || `track-${index + 1}`), title: String(track?.title || track?.name || `歌曲 ${index + 1}`), subtitle: String(track?.subtitle || track?.artist || ""), url } : null;
  }).filter(Boolean), [config]);
  const currentTrack = playlist[currentTrackIndex] || null;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { result } = await effectiveApiRequest({ action: "listCheerleadingPlayerBootstrap" });
      if (!result.ok) throw new Error(result.error || "啦啦隊資料載入失敗");
      setStudent(result.data?.student || null);
      setPractices(Array.isArray(result.data?.practices) ? result.data.practices : []);
      setFields(Array.isArray(result.data?.fields) ? result.data.fields : []);
      setAttendance(Array.isArray(result.data?.attendance) ? result.data.attendance : []);
      setVideos(Array.isArray(result.data?.videos) ? result.data.videos : []);
      setConfig(result.data?.config || {});
    } catch (err) {
      setError(err.message || "啦啦隊資料載入失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (currentTrackIndex >= playlist.length) setCurrentTrackIndex(0);
  }, [currentTrackIndex, playlist.length]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.pause(); audio.load(); setAudioError("");
    if (audioPlaying) audio.play().catch(() => { setAudioPlaying(false); setAudioError("瀏覽器暫時阻擋自動播放，請再按一次播放。"); });
  }, [currentTrack, currentTrackIndex]);
  useEffect(() => {
    if (!playingVideo) return undefined;
    const timer = window.setInterval(() => setWatermarkTick(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [playingVideo]);
  useEffect(() => {
    const syncFullscreen = () => setVideoFullscreen(document.fullscreenElement === videoShellRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const attendanceByPractice = useMemo(() => {
    const map = new Map();
    attendance.forEach((row) => {
      const practiceId = normalizeId(row.practiceId || row.practice_id);
      if (practiceId) map.set(practiceId, row);
    });
    return map;
  }, [attendance]);

  const highlightedPracticeId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return normalizeId(new URLSearchParams(window.location.search).get("practiceId"));
  }, []);
  const sortedPractices = useMemo(() => practices.slice().sort((a, b) => {
    const aHighlighted = highlightedPracticeId && normalizeId(a.id) === highlightedPracticeId;
    const bHighlighted = highlightedPracticeId && normalizeId(b.id) === highlightedPracticeId;
    if (aHighlighted !== bHighlighted) return aHighlighted ? -1 : 1;
    return String(a.date || a.startAt || "9999-12-31").localeCompare(String(b.date || b.startAt || "9999-12-31"));
  }), [highlightedPracticeId, practices]);
  const fieldById = useMemo(() => fields.reduce((acc, field) => ({ ...acc, [normalizeId(field.id)]: field }), {}), [fields]);
  const stats = useMemo(() => {
    const total = sortedPractices.length;
    let present = 0;
    let unknown = 0;
    sortedPractices.forEach((practice) => {
      const status = normalizeStatus(attendanceByPractice.get(normalizeId(practice.id))?.status);
      if (PRESENT.has(status)) present += 1;
      if (status === "unknown") unknown += 1;
    });
    return { total, present, unknown, rate: total ? Math.round((present / total) * 100) : 0 };
  }, [attendanceByPractice, sortedPractices]);

  const submit = async (practice, status) => {
    setSaving(true);
    setError("");
    try {
      const { result } = await effectiveApiRequest({ action: "submitCheerleadingAttendance", data: { practiceId: practice.id, status } });
      if (!result.ok) throw new Error(result.error || "出席回覆失敗");
      const saved = result.data?.attendance;
      const practiceId = normalizeId(practice.id);
      setAttendance((current) => current.filter((row) => normalizeId(row.practiceId || row.practice_id) !== practiceId).concat(saved));
    } catch (err) {
      setError(err.message || "出席回覆失敗");
    } finally {
      setSaving(false);
    }
  };

  const playVideo = async (video) => {
    setVideoLoading(true); setError("");
    try {
      const { result } = await effectiveApiRequest({ action: "getCheerleadingVideoPlayback", data: { videoId: video.id } });
      if (!result.ok || !result.data?.url) throw new Error(result.error || "取得播放權限失敗");
      setPlayingVideo(video); setVideoUrl(result.data.url); setVideoPlaying(false); setVideoProgress(0); setVideoDuration(0);
    } catch (err) { setError(err.message || "取得播放權限失敗"); }
    finally { setVideoLoading(false); }
  };

  const enterVideoFullscreen = async () => {
    const shell = videoShellRef.current;
    if (!shell?.requestFullscreen || document.fullscreenElement === shell) return;
    try { await shell.requestFullscreen(); } catch { /* A browser can reject fullscreen outside a direct tap. */ }
  };
  const exitVideoFullscreen = async () => {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
  };
  const startVideoPlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    await enterVideoFullscreen();
    try { await video.play(); } catch (err) { setError(err.message || "無法播放影片"); }
  };
  const toggleVideoPlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await startVideoPlayback(); else video.pause();
  };
  const changeVideoSpeed = (speed) => {
    setVideoSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
  };
  const formatVideoTime = (seconds) => `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, "0")}`;
  const toggleAudio = async () => {
    const audio = audioRef.current; if (!audio || !currentTrack) return;
    setAudioError("");
    if (audio.paused) { try { await audio.play(); } catch { setAudioError("播放失敗，請再試一次。"); } } else audio.pause();
  };
  const selectTrack = (index) => { setCurrentTrackIndex(index); setAudioError(""); };

  return (
    <><style>{`.cheer-player-video-shell{height:clamp(18rem,58dvh,36rem)}.cheer-player-video-shell video{width:100%;height:100%;object-fit:contain}.cheer-player-video-shell:fullscreen,.cheer-player-video-shell:-webkit-full-screen{width:100vw;height:100dvh;border-radius:0}.cheer-player-video-shell:fullscreen video,.cheer-player-video-shell:-webkit-full-screen video{width:100%;height:100%;object-fit:contain}`}</style><main className="min-h-screen bg-pink-50/60 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-pink-600 via-rose-500 to-orange-400 p-6 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-pink-100">115B Cheerleading</p>
          <h1 className="mt-3 text-3xl font-bold">啦啦隊前台</h1>
          <p className="mt-2 text-sm text-pink-50">{student ? `${getName(student)}，這裡可以查看練習並回覆自己的出席狀態。` : "查看練習並回覆自己的出席狀態。"}</p>
        </section>

        <a href="/" className="inline-flex w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-pink-100 transition hover:bg-pink-50">
          回首頁
        </a>

        {error ? <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {loading ? <p className="text-sm text-slate-500">載入中…</p> : null}

        <nav className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm">
          {[{ id: "attendance", label: "練習報名" }, { id: "playlist", label: "歌曲播放" }, { id: "videos", label: "教學影片" }].map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab.id ? "bg-pink-600 text-white" : "text-slate-600 hover:bg-pink-50"}`}>{tab.label}</button>)}
        </nav>

        {activeTab === "attendance" ? <section className="grid gap-3 sm:grid-cols-3">
          {[{ label: "練習場次", value: stats.total }, { label: "已參與/可參與", value: stats.present }, { label: "參與率", value: `${stats.rate}%` }].map((item) => (
            <div key={item.label} className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p></div>
          ))}
        </section> : null}

        {activeTab === "videos" ? <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">啦啦隊教學影片</h2><p className="mt-1 text-xs text-slate-500">限登入同學觀看，請勿錄製或轉傳。</p></div></div>
          {playingVideo && videoUrl ? <div className="mt-4"><p className="mb-2 text-sm font-semibold">{playingVideo.title}</p><div ref={videoShellRef} onContextMenu={(e) => e.preventDefault()} className="cheer-player-video-shell relative overflow-hidden rounded-2xl bg-black"><video key={videoUrl} ref={videoRef} src={videoUrl} playsInline disablePictureInPicture onContextMenu={(e) => e.preventDefault()} onTimeUpdate={(e) => setVideoProgress(e.currentTarget.currentTime)} onLoadedMetadata={(e) => { setVideoDuration(e.currentTarget.duration); e.currentTarget.playbackRate = videoSpeed; }} onPlay={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} /><div className={`pointer-events-none absolute z-10 select-none whitespace-nowrap rounded bg-black/35 px-2 py-1 text-[10px] font-semibold tracking-wide text-white/85 ${["left-3 top-3", "right-3 top-3", "bottom-16 left-3", "bottom-16 right-3"][Math.floor(watermarkTick / 15000) % 4]}`}>{getName(student)} · {new Date(watermarkTick).toLocaleString("zh-TW", { hour12: false })}</div><div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center gap-3 bg-black/75 p-3 text-white"><button type="button" onClick={toggleVideoPlayback} className="rounded bg-white px-3 py-1 text-sm font-bold text-slate-900">{videoPlaying ? "暫停" : "播放並全螢幕"}</button><input aria-label="播放進度" type="range" min="0" max={videoDuration || 0} value={videoProgress} onChange={(e) => { const video = videoRef.current; if (video) video.currentTime = Number(e.target.value); setVideoProgress(Number(e.target.value)); }} className="min-w-24 flex-1" /><span className="text-xs">{formatVideoTime(videoProgress)} / {formatVideoTime(videoDuration)}</span><select aria-label="播放速度" value={videoSpeed} onChange={(e) => changeVideoSpeed(Number(e.target.value))} className="rounded border border-white/60 bg-black px-2 py-1 text-sm">{VIDEO_SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}x</option>)}</select>{videoFullscreen ? <button type="button" onClick={exitVideoFullscreen} className="rounded border border-white/60 px-3 py-1 text-sm">退出全螢幕</button> : <button type="button" onClick={enterVideoFullscreen} className="rounded border border-white/60 px-3 py-1 text-sm">全螢幕</button>}</div></div></div> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{videos.length ? videos.map((video) => <button key={video.id} type="button" disabled={videoLoading} onClick={() => playVideo(video)} className="rounded-2xl border border-pink-100 bg-pink-50/40 p-4 text-left hover:bg-pink-50 disabled:opacity-60"><p className="font-semibold text-slate-900">{video.title}</p>{video.category ? <p className="mt-1 text-xs font-semibold text-pink-700">{video.category}</p> : null}{video.description ? <p className="mt-2 text-sm text-slate-500">{video.description}</p> : null}<p className="mt-3 text-xs font-semibold text-pink-700">{videoLoading ? "取得播放權限…" : "點此觀看"}</p></button>) : <p className="text-sm text-slate-500">目前尚未上架教學影片。</p>}</div>
        </section> : null}

        {activeTab === "playlist" ? <section className="rounded-3xl bg-gradient-to-br from-pink-600 via-rose-500 to-orange-400 p-5 text-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">啦啦隊歌曲</h2><p className="mt-1 text-xs text-pink-100">選曲後可直接播放；可用系統播放器調整音量與進度。</p></div>{currentTrack ? <button type="button" onClick={toggleAudio} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-pink-700">{audioPlaying ? "暫停播放" : "開始播放"}</button> : null}</div>{currentTrack ? <div className="mt-5 rounded-2xl bg-white/15 p-4"><p className="text-xs font-semibold tracking-[0.2em] text-pink-100">現在播放</p><p className="mt-2 text-2xl font-bold">{currentTrack.title}</p>{currentTrack.subtitle ? <p className="mt-1 text-sm text-pink-100">{currentTrack.subtitle}</p> : null}<audio ref={audioRef} className="mt-4 w-full" controls preload="none" src={currentTrack.url} loop onPlay={() => { setAudioPlaying(true); setAudioError(""); }} onPause={() => setAudioPlaying(false)} onError={() => { setAudioPlaying(false); setAudioError("音檔載入失敗，請確認路徑是否正確。"); }} />{audioError ? <p className="mt-2 text-xs text-rose-100">{audioError}</p> : null}</div> : <p className="mt-5 text-sm text-pink-100">目前尚未設定歌曲。</p>}<div className="mt-4 space-y-2">{playlist.map((track, index) => <button key={track.id} type="button" onClick={() => selectTrack(index)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm ${index === currentTrackIndex ? "bg-white text-pink-700" : "bg-white/15 text-white hover:bg-white/25"}`}><span className="font-semibold">{track.title}</span><span className="text-xs opacity-80">{index === currentTrackIndex ? "播放中" : "選擇"}</span></button>)}</div></section> : null}

        {activeTab === "attendance" ? <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">練習與出席回覆</h2>
            <button type="button" onClick={load} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">重新整理</button>
          </div>
          <div className="mt-4 space-y-3">
            {sortedPractices.length ? sortedPractices.map((practice) => {
              const record = attendanceByPractice.get(normalizeId(practice.id));
              const status = normalizeStatus(record?.status);
              const field = fieldById[normalizeId(practice.fieldId)] || null;
              const locationLabel = practice.location || field?.name || "未填地點";
              return (
                <div key={practice.id} className={`rounded-2xl border p-4 ${highlightedPracticeId && normalizeId(practice.id) === highlightedPracticeId ? "border-pink-300 bg-pink-50/50" : "border-slate-200"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{formatPracticeSchedule(practice)} · {practice.title || "啦啦隊練習"}</p><p className="mt-1 text-sm text-slate-500">{locationLabel}{field?.address ? ` · ${field.address}` : ""}{practice.focus ? ` · ${practice.focus}` : ""}</p>{field?.mapUrl ? <a href={field.mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-pink-700 underline">查看地圖</a> : null}</div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">目前：{labelByStatus[status]}</span>
                  </div>
                  {practice.notes ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{practice.notes}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {OPTIONS.filter((item) => item.value !== "unknown").map((item) => (
                      <button key={item.value} disabled={saving} type="button" onClick={() => submit(practice, item.value)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === item.value ? item.tone : "border-slate-200 bg-white text-slate-600"}`}>{item.label}</button>
                    ))}
                  </div>
                </div>
              );
            }) : <p className="text-sm text-slate-500">目前尚無練習。</p>}
          </div>
        </section> : null}
      </div>
    </main></>
  );
}

export default CheerleadingPlayerPage;
