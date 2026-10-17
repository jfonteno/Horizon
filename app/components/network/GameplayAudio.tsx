"use client";

import { useEffect, useRef, useState } from "react";

type SoundSettings = { musicMuted: boolean; musicVolume: number };
const defaults: SoundSettings = { musicMuted: false, musicVolume: 35 };

function preferences(): SoundSettings {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem("horizon-settings-v1") || "{}") }; }
  catch { return defaults; }
}

export default function GameplayAudio() {
  const audio = useRef<HTMLAudioElement>(null);
  const [settings, setSettings] = useState<SoundSettings>(defaults);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const sync = () => { setSettings(preferences()); setReady(true); };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("horizon-settings-changed", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("horizon-settings-changed", sync); };
  }, []);
  useEffect(() => {
    const music = audio.current;
    if (!music || !ready) return;
    music.volume = Math.max(0, Math.min(1, settings.musicVolume / 100));
    music.muted = settings.musicMuted;
    if (settings.musicMuted) music.pause();
    else void music.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }, [ready, settings.musicMuted, settings.musicVolume]);
  useEffect(() => {
    const resume = () => { if (ready && !settings.musicMuted && audio.current?.paused) void audio.current.play().then(() => setBlocked(false)).catch(() => undefined); };
    document.addEventListener("pointerdown", resume, { once: true });
    return () => document.removeEventListener("pointerdown", resume);
  }, [ready, settings]);
  const toggle = () => {
    const next = { ...settings, musicMuted: !settings.musicMuted };
    setSettings(next);
    localStorage.setItem("horizon-settings-v1", JSON.stringify({ ...preferences(), musicMuted: next.musicMuted }));
    window.dispatchEvent(new Event("horizon-soundtrack-changed"));
    window.dispatchEvent(new Event("horizon-settings-changed"));
  };
  return <div className="gameplay-audio-control" aria-label="Gameplay audio">
    <audio ref={audio} src="/audio/tactical-focus.mp3" loop preload="none" />
    <button type="button" onClick={toggle} aria-label={settings.musicMuted ? "Unmute gameplay music" : "Mute gameplay music"} title={blocked ? "Tap to enable music" : "Tactical Focus gameplay soundtrack"}>{settings.musicMuted ? "Music off" : blocked ? "Play music" : "Music on"}</button>
  </div>;
}
