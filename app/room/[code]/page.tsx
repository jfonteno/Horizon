"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import NetworkGameBoard from "../../components/network/NetworkGameBoard";
import { createNetworkRematch, downloadPlaytestReport, forgetRoomIdentity, pollRoomSession, connectPrivateRoom, isCurrentRoomResponse, sendRoomCommandWithRefresh, spectateNetworkRoom, synchronizeRoom, takeCreatedRoom } from "../../lib/room-client";
import type { RoomCommand, RoomSession } from "../../../game";
import { loadInstalledContent } from "../../lib/content-client";

const POLL_MS = 1200;

export default function NetworkRoomPage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();
  const wantsRecovery = searchParams.get("recover") === "1";
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

  const accept = useCallback((next: RoomSession) => { if (!isCurrentRoomResponse(sessionRef.current, next)) return; sessionRef.current = next; setSession(next); setConnection("connected"); setError(""); }, []);
  const refresh = useCallback(async (asSpectator = wantsSpectator) => {
    if (!code) return;
    setConnection("syncing");
    try {
      await loadInstalledContent();
      if (asSpectator) accept(await spectateNetworkRoom(code));
      else {
        accept(await connectPrivateRoom(code, wantsRecovery));
      }
    } catch (cause) { setConnection("offline"); setError(cause instanceof Error ? cause.message : "Unable to connect to the room."); }
  }, [accept, code, wantsSpectator, wantsRecovery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const created = !wantsRecovery && !wantsSpectator ? takeCreatedRoom(code) : null;
      if (created) accept(created);
      else void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accept, code, refresh, wantsRecovery, wantsSpectator]);
  useEffect(() => {
    const reconnect = () => { if (document.visibilityState === "visible" || navigator.onLine) void refresh(sessionRef.current?.role === "spectator"); };
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", reconnect);
    return () => { window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", reconnect); };
  }, [refresh]);
  useEffect(() => {
    if (!roomConnected || (sessionRef.current?.role === "spectator" && spectatorPaused)) return;
    let cancelled = false;
    const controller=new AbortController();
    const synchronize=async()=>{
      while(!cancelled){
        const current=sessionRef.current;if(!current) return;
        try { const next=await synchronizeRoom(current,controller.signal,()=>sessionRef.current || current); if(!cancelled&&next) accept(next); else if(!cancelled) setConnection("connected"); }
        catch(cause) { if(cancelled||(cause instanceof DOMException&&cause.name==="AbortError")) return; setConnection("offline");setError(cause instanceof Error?cause.message:"Room synchronization failed.");
          await new Promise((resolve)=>window.setTimeout(resolve,pollMs)); }
      }
    };
    void synchronize();
    return () => { cancelled = true; controller.abort(); };
  }, [accept, connectedCode, pollMs, roomConnected, spectatorPaused]);

  const runCommand = useCallback(async (command: RoomCommand) => {
    const current = sessionRef.current;
    if (!current || current.role === "spectator") return;
    setBusy(true); setError(""); setMessage("");
    try {
      const next = await sendRoomCommandWithRefresh(current, command);
      accept(next);
      if (["proposeTrade", "proposeAgreement", "proposeTechnology"].includes(command.kind)) {
        const targetId = command.kind === "proposeTechnology" ? command.buyer : command.kind === "proposeTrade" || command.kind === "proposeAgreement" ? command.to : -1;
        const bot = next.game.players[targetId]?.controller.kind === "bot";
        const response = [...next.game.proposals].reverse().find((proposal) => proposal.createdTurn === next.game.turn && (proposal.kind === "technology" ? proposal.buyer === targetId : proposal.to === targetId));
        setMessage(bot && response ? `${next.game.players[targetId].name} ${response.status} the proposal.` : `${command.kind} accepted at revision ${next.revision}.`);
      } else setMessage(`${command.kind} accepted at revision ${next.revision}.`);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The server rejected that action."); try { const latest = await pollRoomSession(current); if (latest) accept(latest); } catch { setConnection("offline"); } }
    finally { setBusy(false); }
  }, [accept]);
  const leave = () => { if (session?.role !== "spectator") forgetRoomIdentity(code); router.push("/"); };
  const exportReport = async () => {
    const current = sessionRef.current;
    if (!current) return;
    setBusy(true); setError("");
    try { await downloadPlaytestReport(current); setMessage("Playtest report downloaded with audit verification data."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Playtest report export failed."); }
    finally { setBusy(false); }
  };
  const createRematch = async () => {
    const current = sessionRef.current;
    if (!current) return;
    setBusy(true); setError("");
    try {
      const rematch = await createNetworkRematch(current);
      window.location.assign(`/room/${rematch.code}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Rematch creation failed."); }
    finally { setBusy(false); }
  };

  if (!session) return <main className="remote-room"><section className="remote-card"><img src="/horizon-logo.png" alt="Horizon" /><p>NETWORK OPERATIONS // ROOM {code || "UNKNOWN"}</p><h1>{connection === "syncing" ? "Connecting…" : "Room unavailable"}</h1>{error && <p className="room-error">{error}</p>}<div className="remote-actions"><button className="primary" onClick={() => void refresh(false)}>Retry private seat</button><button onClick={() => void refresh(true)}>Watch as spectator</button><button onClick={() => router.push("/")}>Return</button></div></section></main>;

  return <NetworkGameBoard session={session} connection={connection} busy={busy} message={message} error={error} onCommand={runCommand} onRefresh={() => void refresh(session.role === "spectator")} onLeave={leave} onExportReport={() => void exportReport()} onRematch={() => void createRematch()} spectatorPaused={spectatorPaused} pollMs={pollMs} onToggleSpectator={() => setSpectatorPaused((value) => !value)} onPollMs={setPollMs} />;
}
