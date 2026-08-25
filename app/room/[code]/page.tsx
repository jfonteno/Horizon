"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import NetworkGameBoard from "../../components/network/NetworkGameBoard";
import { forgetRoomIdentity, loadRoomIdentity, pollRoomSession, resumeNetworkRoom, sendRoomCommandWithRefresh, spectateNetworkRoom } from "../../lib/room-client";
import type { RoomCommand, RoomSession } from "../../../game";
import { loadInstalledContent } from "../../lib/content-client";

const POLL_MS = 1200;

export default function NetworkRoomPage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();
  const wantsSpectator = searchParams.get("spectate") === "1";
  const [session, setSession] = useState<RoomSession | null>(null);
  const sessionRef = useRef<RoomSession | null>(null);
  const [connection, setConnection] = useState<"connected" | "syncing" | "offline">("syncing");
  const [busy, setBusy] = useState(false);
  const [spectatorPaused, setSpectatorPaused] = useState(false);
  const [pollMs, setPollMs] = useState(POLL_MS);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const roomConnected = session !== null;
  const connectedCode = session?.code;

  const accept = useCallback((next: RoomSession) => { sessionRef.current = next; setSession(next); setConnection("connected"); setError(""); }, []);
  const refresh = useCallback(async (asSpectator = wantsSpectator) => {
    if (!code) return;
    setConnection("syncing");
    try {
      await loadInstalledContent();
      if (asSpectator) accept(await spectateNetworkRoom(code));
      else {
        const identity = loadRoomIdentity(code);
        if (!identity?.token) throw new Error("This browser has not claimed a seat in this room.");
        accept(await resumeNetworkRoom(code, identity.token));
      }
    } catch (cause) { setConnection("offline"); setError(cause instanceof Error ? cause.message : "Unable to connect to the room."); }
  }, [accept, code, wantsSpectator]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!roomConnected || (sessionRef.current?.role === "spectator" && spectatorPaused)) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      const current = sessionRef.current;
      if (!current) return;
      try { const next = await pollRoomSession(current); if (!cancelled && next) accept(next); }
      catch (cause) { if (!cancelled) { setConnection("offline"); setError(cause instanceof Error ? cause.message : "Room synchronization failed."); } }
    }, pollMs);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [accept, connectedCode, pollMs, roomConnected, spectatorPaused]);

  const runCommand = async (command: RoomCommand) => {
    const current = sessionRef.current;
    if (!current || current.role === "spectator") return;
    setBusy(true); setError(""); setMessage("");
    try { const next = await sendRoomCommandWithRefresh(current, command); accept(next); setMessage(`${command.kind} accepted at revision ${next.revision}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The server rejected that action."); try { const latest = await pollRoomSession(current); if (latest) accept(latest); } catch { setConnection("offline"); } }
    finally { setBusy(false); }
  };
  const leave = () => { if (session?.role !== "spectator") forgetRoomIdentity(code); router.push("/"); };

  if (!session) return <main className="remote-room"><section className="remote-card"><img src="/horizon-logo.png" alt="Horizon" /><p>NETWORK OPERATIONS // ROOM {code || "UNKNOWN"}</p><h1>{connection === "syncing" ? "Connecting…" : "Room unavailable"}</h1>{error && <p className="room-error">{error}</p>}<div className="remote-actions"><button className="primary" onClick={() => void refresh(false)}>Retry private seat</button><button onClick={() => void refresh(true)}>Watch as spectator</button><button onClick={() => router.push("/")}>Return</button></div></section></main>;

  return <NetworkGameBoard session={session} connection={connection} busy={busy} message={message} error={error} onCommand={runCommand} onRefresh={() => void refresh(session.role === "spectator")} onLeave={leave} spectatorPaused={spectatorPaused} pollMs={pollMs} onToggleSpectator={() => setSpectatorPaused((value) => !value)} onPollMs={setPollMs} />;
}
