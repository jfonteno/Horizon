"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { gateTarget, type GameState, type RoomIdentity, type RoomSession } from "../../game";
import { createNetworkRoom, joinNetworkRoom, saveRoomIdentity } from "../lib/room-client";
import { loadAccountToken, resumeCommanderAccount } from "../lib/account-client";

const ROOM_KEY = "horizon-room-identity-v1";

async function roomRequest(body: object): Promise<RoomSession> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as RoomSession & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Room request failed.");
  return payload;
}

function remember(session: RoomSession) {
  const identity: RoomIdentity = {
    code: session.code,
    token: session.token,
    role: session.role,
    playerId: session.playerId,
    revision: session.revision,
  };
  localStorage.setItem(ROOM_KEY, JSON.stringify(identity));
  saveRoomIdentity(session);
  return identity;
}

function recalled(): RoomIdentity | null {
  try {
    return JSON.parse(localStorage.getItem(ROOM_KEY) || "null") as RoomIdentity;
  } catch {
    return null;
  }
}

export function RoomSetup({
  gameFactory,
  startHost,
  openRemote,
  view = "all",
}: {
  gameFactory: () => GameState;
  startHost: (session: RoomSession) => void;
  openRemote: (session: RoomSession) => void;
  view?: "all" | "host" | "join";
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [saved, setSaved] = useState<RoomIdentity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [autoStartWhenReady, setAutoStartWhenReady] = useState(false);
  const [access, setAccess] = useState<{verificationMode:"commander"|"room-code";roomCreationOpen:boolean;spectatorsAllowed:boolean;notice:string|null}>({verificationMode:"commander",roomCreationOpen:true,spectatorsAllowed:true,notice:null});

  useEffect(() => {
    setSignedIn(Boolean(loadAccountToken()));
    void resumeCommanderAccount().then(()=>setSignedIn(true)).catch(()=>setSignedIn(false));
    void fetch("/api/auth/providers",{cache:"no-store"}).then(response=>response.json() as Promise<{multiplayerAccess?:typeof access}>).then(payload=>payload.multiplayerAccess&&setAccess(payload.multiplayerAccess)).catch(()=>undefined);
    setSaved(recalled());
    const invited = new URLSearchParams(window.location.search).get("join");
    if (invited) setCode(invited.toUpperCase().slice(0, 6));
  }, []);

  const act = async (fn: () => Promise<RoomSession>) => {
    setBusy(true);
    setError("");
    try {
      const session = await fn();
      setSaved(remember(session));
      if (session.summary.mode === "network") window.location.assign(`/room/${session.code}`);
      else if (session.role === "host") startHost(session);
      else openRemote(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Room request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="room-setup premium-room-setup" data-view={view}>
      <div className="room-heading">
        <div>
          <span>0.35.4 CONNECTED COMMAND</span>
          <h3>Persistent online game rooms</h3>
        </div>
        <small>
          Ready a private seat, reconnect safely, command fleets, negotiate, or watch the public board.
        </small>
      </div>
      {access.notice&&<div className="network-operations-notice"><b>HORIZON OPERATIONS</b><span>{access.notice}</span></div>}
      {!signedIn && access.verificationMode==="commander" && <div className="network-account-gate">
        <span>COMMANDER ACCOUNT REQUIRED</span>
        <h3>Sign in before entering the Horizon Network.</h3>
        <p>Your profile keeps room access, statistics, achievements, and emblems synchronized across devices.</p>
        <button className="primary" onClick={() => { const invite=code.length===6?`/?join=${code}`:"/?open=create"; window.location.assign(`/?open=profile&returnTo=${encodeURIComponent(invite)}`); }}>Open Commander Profile</button>
      </div>}
      {access.verificationMode==="room-code"&&<div className="network-account-gate room-code-access"><span>ROOM CODE ACCESS</span><h3>Temporary playtest access is active.</h3><p>Enter a display name and use the invitation code. This seat remains tied to this browser unless you also sign in to a Commander account.</p><label>Display name<input value={name} maxLength={32} onChange={event=>setName(event.target.value)} placeholder="Commander name"/></label></div>}
      <div className="room-setup-grid">
        {view !== "join" && <div>
          <b>Host a room</b>
          <p>Create an invitation code. Human players choose factions after claiming their seats.</p>
          <label className="room-name-create">
            Room name <small>Optional</small>
            <input value={roomName} maxLength={48} onChange={(event) => setRoomName(event.target.value)} placeholder="Defaults to the room code" />
          </label>
          <label className="room-auto-start-create">
            <input type="checkbox" checked={autoStartWhenReady} onChange={(event) => setAutoStartWhenReady(event.target.checked)} />
            <span><b>Start automatically when ready</b><small>The server launches as soon as every human has claimed a faction and readied. You do not need to remain online.</small></span>
          </label>
          <button
            className="primary"
            disabled={busy || !access.roomCreationOpen || (access.verificationMode==="commander"?!signedIn:!name.trim())}
            onClick={() =>
              act(() =>
                createNetworkRoom(gameFactory(), name || "Host", autoStartWhenReady, roomName),
              )
            }
          >
            {access.roomCreationOpen?"Create room":"Room creation paused"}
          </button>
        </div>}
        {view !== "host" && <div className="room-join">
          <b>Join a private seat</b>
          <label>
            Invitation code
            <input
              value={code}
              maxLength={6}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ABC234"
            />
          </label>
          <button
            disabled={busy || code.length !== 6 || (access.verificationMode==="commander"?!signedIn:!name.trim())}
            onClick={() =>
              act(() =>
                joinNetworkRoom(code, -1, name),
              )
            }
          >
            Claim an open human seat
          </button>
          <button disabled={busy || code.length !== 6 || !access.spectatorsAllowed} onClick={() => window.location.assign(`/room/${code}?spectate=1`)}>{access.spectatorsAllowed?"Watch room":"Spectating paused"}</button>
        </div>}
      </div>
      {saved && (
        <button
          className="room-resume"
          disabled={busy}
          onClick={() => window.location.assign(`/room/${saved.code}`)}
        >
          Resume saved room {saved.code}
        </button>
      )}
      {error && <p className="room-error">{error}</p>}
    </section>
  );
}

export function RoomConsole({ game }: { game: GameState }) {
  const [identity, setIdentity] = useState<RoomIdentity | null>(null);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setIdentity(recalled()), []);

  const request = async (body: object) => {
    setBusy(true);
    setMessage("");
    try {
      const next = await roomRequest(body);
      const nextIdentity = remember(next);
      setIdentity(nextIdentity);
      setSession(next);
      setMessage(`Room ${next.code} is synchronized at revision ${next.revision}.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Room request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="room-console">
      <h3>Network room</h3>
      <p>
        The host publishes authoritative snapshots. Claimed seats receive only
        their own surveys, objectives, proposals, and pending Labor.
      </p>
      {!identity ? (
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            request({ action: "create", game, displayName: "Host" })
          }
        >
          Create room from this game
        </button>
      ) : (
        <>
          <div className="room-code">
            <span>Invitation code</span>
            <strong>{identity.code}</strong>
          </div>
          <div className="room-actions">
            <button
              disabled={busy}
              onClick={() =>
                request({
                  action: "resume",
                  code: identity.code,
                  token: identity.token,
                })
              }
            >
              Refresh room
            </button>
            {identity.role === "host" && (
              <button
                disabled={busy}
                onClick={() =>
                  request({
                    action: "save",
                    code: identity.code,
                    token: identity.token,
                    expectedRevision: identity.revision,
                    game,
                  })
                }
              >
                Publish current state
              </button>
            )}
          </div>
        </>
      )}
      {session && (
        <div className="room-seats">
          {session.summary.seats.map((seat) => (
            <span key={seat.playerId} className={seat.claimed ? "claimed" : ""}>
              <i>{seat.playerId + 1}</i>
              <b>{seat.civilization}</b>
              <small>{seat.displayName || "Open seat"}</small>
            </span>
          ))}
        </div>
      )}
      {message && <small className="room-message">{message}</small>}
      <small className="muted">
        Network rooms support server-authoritative Military, Diplomacy, and
        simultaneous secret Orders.
      </small>
    </div>
  );
}

export function RemoteRoomView({
  initial,
  close,
}: {
  initial: RoomSession;
  close: () => void;
}) {
  const [session, setSession] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const player = session.game.players[session.playerId || 0];
  const goal = gateTarget(session.game);

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await roomRequest({
        action: "resume",
        code: session.code,
        token: session.token,
      });
      remember(next);
      setSession(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="remote-room" data-theme={session.game.themeId}>
      <section className="remote-card">
        <img src="/horizon-logo.png" alt="Horizon" />
        <p>PRIVATE NETWORK SEAT // ROOM {session.code}</p>
        <h1>{player.name}</h1>
        <div className="remote-status">
          <span>
            Era <b>{session.game.era}</b>
          </span>
          <span>
            Turn <b>{session.game.turn}</b>
          </span>
          <span>
            Gate <b>{session.game.gate} / {goal}</b>
          </span>
          <span>
            Revision <b>{session.revision}</b>
          </span>
        </div>
        <div className="remote-columns">
          <div>
            <h3>Room seats</h3>
            {session.summary.seats.map((seat) => (
              <span key={seat.playerId}>
                <b>{seat.civilization}</b>
                <small>{seat.displayName || "Open seat"}</small>
              </span>
            ))}
          </div>
          <div>
            <h3>Private survey archive</h3>
            {player.privateSurveys.length ? (
              player.privateSurveys.map((survey) => (
                <span key={survey.hexId}>
                  <b>{survey.hexId}</b>
                  <small>{survey.kind}</small>
                </span>
              ))
            ) : (
              <small>No private surveys recorded.</small>
            )}
          </div>
        </div>
        {error && <p className="room-error">{error}</p>}
        <div className="remote-actions">
          <button className="primary" disabled={busy} onClick={refresh}>
            Refresh private view
          </button>
          <button onClick={close}>Return to launch screen</button>
        </div>
        <small className="muted">
          Legacy read-only room view. Network rooms open on the shared
          interactive board.
        </small>
      </section>
    </main>
  );
}
