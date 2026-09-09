"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { gateTarget, type GameState, type RoomIdentity, type RoomSession } from "../../game";
import { saveRoomIdentity } from "../lib/room-client";

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
}: {
  gameFactory: () => GameState;
  startHost: (session: RoomSession) => void;
  openRemote: (session: RoomSession) => void;
}) {
  const [code, setCode] = useState("");
  const [seat, setSeat] = useState(1);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<RoomIdentity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
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
    <section className="room-setup">
      <div className="room-heading">
        <div>
          <span>0.20.2 NETWORK PLAYTEST</span>
          <h3>Persistent online game rooms</h3>
        </div>
        <small>
          Ready a private seat, reconnect safely, command fleets, negotiate, or watch the public board.
        </small>
      </div>
      <div className="room-setup-grid">
        <div>
          <b>Host a room</b>
          <p>Create an invitation code. Human players choose factions after claiming their seats.</p>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              act(() =>
                roomRequest({
                  action: "create",
                  game: gameFactory(),
                  displayName: name || "Host",
                  mode: "network",
                }),
              )
            }
          >
            Create room
          </button>
        </div>
        <div className="room-join">
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
          <label>
            Seat
            <select
              value={seat}
              onChange={(event) => setSeat(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((number) => (
                <option value={number} key={number}>
                  {number}
                </option>
              ))}
            </select>
          </label>
          <label>
            Player name
            <input
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="Player"
            />
          </label>
          <button
            disabled={busy || code.length !== 6}
            onClick={() =>
              act(() =>
                roomRequest({
                  action: "join",
                  code,
                  playerId: seat - 1,
                  displayName: name,
                }),
              )
            }
          >
            Claim seat
          </button>
          <button disabled={busy || code.length !== 6} onClick={() => window.location.assign(`/room/${code}?spectate=1`)}>Watch room</button>
        </div>
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
