"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import type { GameState, RoomIdentity, RoomSession } from "../../game";

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

  useEffect(() => setSaved(recalled()), []);

  const act = async (fn: () => Promise<RoomSession>) => {
    setBusy(true);
    setError("");
    try {
      const session = await fn();
      setSaved(remember(session));
      if (session.role === "host") startHost(session);
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
          <span>0.13.0 STRATEGIC MIND</span>
          <h3>Server-backed playtest rooms</h3>
        </div>
        <small>
          Host a synchronized hot-seat game or claim a private read-only seat.
        </small>
      </div>
      <div className="room-setup-grid">
        <div>
          <b>Host a room</b>
          <p>Create an invitation code and publish this device&apos;s game.</p>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              act(() =>
                roomRequest({
                  action: "create",
                  game: gameFactory(),
                  displayName: name || "Host",
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
        </div>
      </div>
      {saved && (
        <button
          className="room-resume"
          disabled={busy}
          onClick={() =>
            act(() =>
              roomRequest({
                action: "resume",
                code: saved.code,
                token: saved.token,
              }),
            )
          }
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
        Live remote commands and simultaneous secret orders remain a later
        multiplayer milestone.
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
  const goal = session.game.players.length * 3;

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
          This seat is intentionally read-only in 0.13.0. The authoritative host
          publishes the current hot-seat state.
        </small>
      </section>
    </main>
  );
}
