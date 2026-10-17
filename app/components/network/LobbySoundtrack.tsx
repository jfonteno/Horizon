"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const tracks = [
  { title: "Into the 'Verse", src: "/audio/lobby/into-the-verse.mp3" },
  { title: "Fighting For the Skies", src: "/audio/lobby/fighting-for-the-skies.mp3" },
  { title: "The Spelljammer", src: "/audio/lobby/the-spelljammer.mp3" },
] as const;

const preferenceKey = "horizon-lobby-music-v1";
const settingsKey = "horizon-settings-v1";

function readPreferences() {
  if (typeof window === "undefined") return {muted:false,volume:35};
  try {
    const legacy=JSON.parse(localStorage.getItem(preferenceKey) || "null");
    const settings=JSON.parse(localStorage.getItem(settingsKey) || "null");
    return {muted:settings?.musicMuted===true||legacy?.muted===true,volume:Math.max(0,Math.min(100,Number(settings?.musicVolume??35)))};
  } catch {
    return {muted:false,volume:35};
  }
}

export default function LobbySoundtrack() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [preferences,setPreferences]=useState(readPreferences);
  const {muted,volume}=preferences;
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const track = tracks[trackIndex];

  const updateMuted=(next:boolean)=>{
    setPreferences(current=>({...current,muted:next}));
    try { const settings=JSON.parse(localStorage.getItem(settingsKey)||"{}");localStorage.setItem(settingsKey,JSON.stringify({...settings,musicMuted:next})); } catch { /* legacy preference remains available */ }
    window.dispatchEvent(new Event("horizon-soundtrack-changed"));
  };

  const start = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || muted) return;
    try {
      await audio.play();
      setPlaying(true);
      setBlocked(false);
    } catch {
      setPlaying(false);
      setBlocked(true);
    }
  }, [muted]);

  useEffect(() => {
    localStorage.setItem(preferenceKey, JSON.stringify({ muted }));
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
    audio.volume = volume / 100;
    if (muted) {
      audio.pause();
      return;
    }
    void audio.play().catch(() => setBlocked(true));
  }, [muted, start, trackIndex, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    const resumeAfterInteraction = () => {
      if (!muted && audio?.paused) void start();
    };
    document.addEventListener("pointerdown", resumeAfterInteraction, { once: true });
    document.addEventListener("keydown", resumeAfterInteraction, { once: true });
    return () => {
      document.removeEventListener("pointerdown", resumeAfterInteraction);
      document.removeEventListener("keydown", resumeAfterInteraction);
      audio?.pause();
    };
  }, [muted, start]);

  useEffect(() => {
    const refresh = () => setPreferences(readPreferences());
    window.addEventListener("storage", refresh);
    window.addEventListener("horizon-settings-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("horizon-settings-changed", refresh);
    };
  }, []);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (muted) {
      updateMuted(false);
    } else if (audio.paused) {
      void start();
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="lobby-soundtrack" aria-label="Horizon menu soundtrack">
      <audio
        ref={audioRef}
        src={track.src}
        preload="auto"
        onPlay={() => { setPlaying(true); setBlocked(false); }}
        onPause={() => setPlaying(false)}
        onCanPlay={() => { if (!muted && audioRef.current?.paused) void start(); }}
        onEnded={() => setTrackIndex(current => (current + 1) % tracks.length)}
        onError={() => setTrackIndex(current => (current + 1) % tracks.length)}
      />
      <span><i className={playing ? "playing" : ""} />HORIZON SOUNDTRACK</span>
      <b>{track.title}</b>
      <small>{muted ? "Music muted" : blocked ? "Browser paused autoplay" : playing ? `Track ${trackIndex + 1} of ${tracks.length}` : "Music paused"}</small>
      <div>
        <button type="button" onClick={togglePlayback}>{muted || blocked || !playing ? "Play" : "Pause"}</button>
        <button type="button" onClick={() => updateMuted(!muted)}>{muted ? "Unmute" : "Mute"}</button>
        <button type="button" aria-label="Next soundtrack track" onClick={() => setTrackIndex(current => (current + 1) % tracks.length)}>Next</button>
      </div>
    </div>
  );
}
