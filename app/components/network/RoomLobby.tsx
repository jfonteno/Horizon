"use client";

import { useState } from "react";
import type { RoomCommand } from "../../../game/server/command";
import type { RoomSession } from "../../../game/server/types";

export default function RoomLobby({
  session,
  onRefresh,
  onLeave,
  onCommand,
  onExportReport,
  busy = false,
}: {
  session: RoomSession;
  onRefresh?: () => void;
  onLeave?: () => void;
  onCommand?: (command: RoomCommand) => Promise<void>;
  onExportReport?: () => void;
  busy?: boolean;
}) {
  const seats = session.summary.seats;
  const humanSeats = seats.filter((seat) => seat.controller?.kind !== "bot");
  const claimedHumans = humanSeats.filter((seat) => seat.claimed).length;
  const openHumans = humanSeats.length - claimedHumans;
  const mine = session.playerId === undefined ? undefined : seats[session.playerId];
  const host = session.role === "host";
  const allReady = seats.every((seat) => Boolean(seat.faction)) && humanSeats.every((seat) => seat.claimed && seat.ready);
  const copy = (value: string) => void navigator.clipboard?.writeText(value);
  const [hostNotice, setHostNotice] = useState("");
  const [timerMinutes, setTimerMinutes] = useState(session.summary.turnTimerSeconds ? String(session.summary.turnTimerSeconds / 60) : "0");
  const [factionViewId, setFactionViewId] = useState<string | null>(null);
  const viewedFaction = session.summary.availableFactions.find((faction) => faction.id === factionViewId);
  const viewedSelectedBy = viewedFaction ? seats.find((seat) => seat.faction === viewedFaction.id) : undefined;
  const viewedTaken = Boolean(viewedSelectedBy && viewedSelectedBy.playerId !== mine?.playerId);

  return (
    <section className="room-lobby">
      <div className="room-heading">
        <div>
          <span>0.20.2 ONLINE LOBBY</span>
          <h2>Room {session.code}</h2>
        </div>
        <small>
          {claimedHumans}/{humanSeats.length} human seats claimed
          {openHumans ? ` · ${openHumans} open` : ""}
        </small>
      </div>

      <div className="room-code">
        <span>Invitation code</span>
        <strong>{session.code}</strong>
      </div>
      <div className="invite-links">
        <button type="button" onClick={() => copy(`${window.location.origin}/?join=${session.code}`)}>Copy player invitation</button>
        <button type="button" onClick={() => copy(`${window.location.origin}/room/${session.code}?spectate=1`)}>Copy spectator link</button>
      </div>

      <section className="turn-timer-summary">
        <span>Turn timer</span>
        <b>{session.summary.turnTimerSeconds ? `${Math.round(session.summary.turnTimerSeconds / 60)} minutes` : "Disabled"}</b>
        <small>{session.summary.turnTimerSeconds ? "When time expires, unsubmitted civilizations receive Hold and the Turn resolves." : "Turns resolve after every civilization seals Orders."}</small>
      </section>

      {host && onCommand && ["lobby", "paused"].includes(session.summary.status) && (
        <section className="turn-timer-settings">
          <label>Room Turn timer
            <select value={timerMinutes} disabled={busy} onChange={(event) => setTimerMinutes(event.target.value)}>
              <option value="0">No timer</option>
              {[5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
            </select>
          </label>
          <button type="button" disabled={busy || (session.summary.turnTimerSeconds || 0) === Number(timerMinutes) * 60} onClick={() => void onCommand({ kind: "setTurnTimer", seconds: Number(timerMinutes) ? Number(timerMinutes) * 60 : null })}>Apply timer</button>
        </section>
      )}

      {onCommand && session.summary.status === "lobby" && mine?.controller.kind === "human" && (
        <section className="faction-draft">
          <div className="faction-draft-heading">
            <span>Your faction</span>
            <small>{mine.faction ? "Selection locked when you mark ready" : "Choose before marking ready"}</small>
          </div>
          <div className="faction-draft-grid">
            {session.summary.availableFactions.map((faction) => {
              const selectedBy = seats.find((seat) => seat.faction === faction.id);
              const mineSelected = mine.faction === faction.id;
              const taken = Boolean(selectedBy && selectedBy.playerId !== mine.playerId);
              return <button
                key={faction.id}
                type="button"
                className={`${mineSelected ? "selected" : ""} ${taken ? "taken" : ""}`}
                style={{ "--faction-color": faction.color } as React.CSSProperties}
                aria-pressed={mineSelected}
                onClick={() => setFactionViewId(faction.id)}
              >
                {faction.logo && <img src={faction.logo} alt="" />}
                <span><b>{faction.name}</b><small>{taken ? `Chosen by seat ${selectedBy!.playerId + 1}` : mineSelected ? "Your current selection" : `${faction.role} · View faction`}</small></span>
              </button>;
            })}
          </div>
          <button type="button" className={`faction-ready-action ${mine.ready ? "ready" : ""}`} disabled={busy || (!mine.faction && !mine.ready)} onClick={() => void onCommand({ kind: "setReady", ready: !mine.ready })}>
            {mine.ready ? "Ready. Unlock to change faction" : mine.faction ? `Confirm ${mine.civilization} and mark ready` : "Select a faction above"}
          </button>
        </section>
      )}

      {onCommand && session.summary.status === "lobby" && mine?.controller.kind === "human" && viewedFaction && (
        <div className="faction-browser-overlay" role="dialog" aria-modal="true" aria-label={`${viewedFaction.name} faction profile`} style={{ "--faction-color": viewedFaction.color } as React.CSSProperties}>
          <section className="faction-browser">
            <header>
              <div><span>FACTION ARCHIVE</span><b>Choose your civilization</b></div>
              <button type="button" onClick={() => setFactionViewId(null)}>Return to lobby</button>
            </header>
            <nav aria-label="Available factions">
              {session.summary.availableFactions.map((faction) => {
                const selectedBy = seats.find((seat) => seat.faction === faction.id);
                return <button key={faction.id} type="button" className={faction.id === viewedFaction.id ? "active" : ""} style={{ "--nav-faction": faction.color } as React.CSSProperties} onClick={() => setFactionViewId(faction.id)}>
                  {faction.logo ? <img src={faction.logo} alt="" /> : <i>{faction.name.slice(0, 2)}</i>}
                  <span><b>{faction.name}</b><small>{selectedBy ? `Seat ${selectedBy.playerId + 1}` : faction.role}</small></span>
                </button>;
              })}
            </nav>
            <article className="faction-profile">
              <section className="faction-profile-hero">
                {viewedFaction.logo && <img src={viewedFaction.logo} alt={`${viewedFaction.name} emblem`} />}
                <div><span>{viewedFaction.role.toUpperCase()} CIVILIZATION</span><h1>{viewedFaction.name}</h1><p>{viewedFaction.blurb}</p></div>
              </section>
              <section className="faction-profile-lore">
                <h2>Civilization</h2>
                {(viewedFaction.lore?.length ? viewedFaction.lore : [viewedFaction.blurb || "No faction archive is available for this installed content pack."]).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </section>
              <section className="faction-profile-abilities">
                <h2>Faction abilities</h2>
                <div>{(viewedFaction.abilities || []).map((ability) => <article key={ability.name}><span><b>{ability.name}</b>{ability.unlock && <small>{ability.unlock}</small>}</span><p>{ability.summary}</p></article>)}</div>
                {!viewedFaction.abilities?.length && <p className="faction-profile-empty">This installed faction uses its pack description and objectives. Detailed ability notes were not supplied by the pack.</p>}
              </section>
              <section className="faction-profile-summary">
                <div><span>Strategic role</span><b>{viewedFaction.role}</b></div>
                <div><span>Homeworld production</span><b>{viewedFaction.homeProduction ? viewedFaction.homeProduction[0].toUpperCase() + viewedFaction.homeProduction.slice(1) : "Pack defined"}</b></div>
              </section>
              <section className="faction-profile-objectives">
                <h2>Civilization Legacy</h2>
                <div>{(viewedFaction.objectives || []).map((objective, index) => <span key={objective}><i>{index + 1}</i><b>{objective}</b></span>)}</div>
              </section>
              <footer>
                <span>{viewedTaken ? `${viewedFaction.name} has already been chosen by seat ${viewedSelectedBy!.playerId + 1}.` : mine.ready ? "Unlock your Ready status before changing factions." : mine.faction === viewedFaction.id ? "This is your current faction selection." : "This faction is available."}</span>
                <button type="button" className="primary" disabled={busy || mine.ready || viewedTaken || mine.faction === viewedFaction.id} onClick={async () => { await onCommand({ kind: "selectFaction", factionId: viewedFaction.id }); setFactionViewId(null); }}>{mine.faction === viewedFaction.id ? "Currently selected" : viewedTaken ? "Faction unavailable" : `Select ${viewedFaction.name}`}</button>
              </footer>
            </article>
          </section>
        </div>
      )}

      <div className="room-seats">
        {seats.map((seat) => {
          const bot = seat.controller?.kind === "bot";
          const profileId =
            seat.controller?.kind === "bot" ? seat.controller.profileId : null;
          const mine = session.playerId === seat.playerId;

          return (
            <span
              key={seat.playerId}
              className={seat.claimed ? "claimed" : ""}
              aria-current={mine ? "true" : undefined}
            >
              <i>{seat.playerId + 1}</i>
              <b>
                {seat.faction ? seat.civilization : "Awaiting faction choice"}
                {mine ? " · YOU" : ""}
              </b>
              <small>
                {bot
                  ? `AI · ${profileId}`
                  : `${seat.displayName || "Open human seat"}${seat.ready ? " · READY" : seat.claimed ? " · NOT READY" : ""}`}
              </small>
            </span>
          );
        })}
      </div>

      <div className="room-actions">
        {onCommand && host && session.summary.status === "lobby" && (
          <button className="primary" disabled={busy || !allReady} onClick={() => void onCommand({ kind: "startGame" })}>Start game</button>
        )}
        {onCommand && host && session.summary.status === "active" && (
          <button disabled={busy} onClick={() => void onCommand({ kind: "pauseGame" })}>Pause game</button>
        )}
        {onCommand && host && session.summary.status === "paused" && (
          <button className="primary" disabled={busy} onClick={() => void onCommand({ kind: "resumeGame" })}>Resume game</button>
        )}
        {onCommand && host && ["active", "paused"].includes(session.summary.status) && (
          <button disabled={busy} onClick={() => void onCommand({ kind: "endGame" })}>End and archive</button>
        )}
        {onRefresh && (
          <button disabled={busy} onClick={onRefresh}>
            Refresh room
          </button>
        )}
        {host && onExportReport && <button disabled={busy} onClick={onExportReport}>Download playtest report</button>}
        {onLeave && (
          <button disabled={busy} onClick={onLeave}>
            Leave view
          </button>
        )}
      </div>

      {host && onCommand && ["lobby", "paused"].includes(session.summary.status) && (
        <div className="bot-takeover-list">
          <h3>Room administration</h3>
          {seats.filter((seat) => seat.playerId !== session.playerId).map((seat) => (
            <div key={seat.playerId}>
              <span><b>{seat.faction ? seat.civilization : `Seat ${seat.playerId + 1}`}</b><small>{seat.displayName || "Open seat"}</small></span>
              <span className="admin-seat-actions">
                {seat.controller.kind === "bot"
                  ? <button disabled={busy} onClick={() => void onCommand({ kind: "convertSeatToHuman", playerId: seat.playerId })}>Open to human</button>
                  : <>
                    {seat.claimed && <button disabled={busy} onClick={() => void onCommand({ kind: "setSeatReady", playerId: seat.playerId, ready: !seat.ready })}>{seat.ready ? "Clear ready" : "Force ready"}</button>}
                    {seat.claimed && <button disabled={busy} onClick={() => void onCommand({ kind: "resetHumanSeat", playerId: seat.playerId })}>Reopen seat</button>}
                    <button disabled={busy} onClick={() => void onCommand({ kind: "convertSeatToBot", playerId: seat.playerId, profileId: "strategic-director" })}>Assign AI</button>
                  </>}
              </span>
            </div>
          ))}
          <div className="host-notice-compose">
            <input value={hostNotice} maxLength={240} placeholder="Post a rules or timing notice to the room" onChange={(event) => setHostNotice(event.target.value)} />
            <button disabled={busy || !hostNotice.trim()} onClick={() => { void onCommand({ kind: "postHostNotice", message: hostNotice.trim() }); setHostNotice(""); }}>Post notice</button>
          </div>
        </div>
      )}

      {!!session.summary.recentEvents.length && <div className="room-event-list"><h3>Room history</h3>{[...session.summary.recentEvents].reverse().slice(0, 8).map((event) => <p key={event.id}><b>R{event.revision}</b>{event.message}</p>)}</div>}

      <small className="muted">
        Human players claim seats first, then choose an unclaimed faction. Ready
        players must unlock their seat before changing factions.
      </small>
    </section>
  );
}
