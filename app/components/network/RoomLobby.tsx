"use client";

import { useState } from "react";
import type { RoomCommand } from "../../../game/server/command";
import type { RoomSession } from "../../../game/server/types";
import { factionLibrary, gameFormats, mapLibrary } from "../../../game";
import LobbySoundtrack from "./LobbySoundtrack";
import { factionGuides } from "../../../game/factions/guides";
import { botChallengeLabel, botChallengeOptions } from "../../../bots";

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
  const allReady = seats.every((seat) => Boolean(seat.faction) || (seat.controller.kind === "bot" && seat.randomFaction)) && humanSeats.every((seat) => seat.claimed && seat.ready);
  const copy = (value: string) => void navigator.clipboard?.writeText(value);
  const [hostNotice, setHostNotice] = useState("");
  const [roomNameDraft, setRoomNameDraft] = useState(session.summary.name);
  const [timerMinutes, setTimerMinutes] = useState(session.summary.turnTimerSeconds ? String(session.summary.turnTimerSeconds / 60) : "0");
  const [factionViewId, setFactionViewId] = useState<string | null>(null);
  const [factionSeatId, setFactionSeatId] = useState<number | null>(null);
  const viewedFaction = session.summary.availableFactions.find((faction) => faction.id === factionViewId);
  const factionSeat = factionSeatId === null ? undefined : seats.find((seat) => seat.playerId === factionSeatId);
  const choosingForBot = factionSeat?.controller.kind === "bot";
  const viewedSelectedBy = viewedFaction ? seats.find((seat) => seat.faction === viewedFaction.id) : undefined;
  const viewedTaken = Boolean(viewedSelectedBy && viewedSelectedBy.playerId !== factionSeat?.playerId);
  const map = mapLibrary[session.game.mapId];
  const format = gameFormats[session.game.format];
  const contentPacks = session.game.contentPacks || [];
  const missingFaction = seats.filter((seat) => !seat.faction && !(seat.controller.kind === "bot" && seat.randomFaction)).length;
  const waitingHumans = humanSeats.filter((seat) => !seat.claimed || !seat.ready).length;
  const openFactionBrowser = (playerId: number) => {
    const target = seats.find((seat) => seat.playerId === playerId);
    if (!target || session.summary.status !== "lobby") return;
    const mayChoose = target.controller.kind === "bot" ? host : target.playerId === mine?.playerId;
    if (!mayChoose || (target.controller.kind === "human" && target.ready)) return;
    setFactionSeatId(playerId);
    setFactionViewId(target.faction || session.summary.availableFactions[0]?.id || null);
  };
  const closeFactionBrowser = () => { setFactionViewId(null); setFactionSeatId(null); };

  return (
    <section className="room-lobby">
      <div className="room-heading">
        <div>
          <span>0.35.4 FACTION SELECTION</span>
          <h2>{session.summary.name}</h2>
        </div>
        <small>
          {claimedHumans}/{humanSeats.length} human seats claimed
          {openHumans ? ` · ${openHumans} open` : ""}
        </small>
      </div>

      {session.summary.status === "lobby" && <LobbySoundtrack />}

      <div className="room-code">
        <span>Invitation code</span>
        <strong>{session.code}</strong>
      </div>
      {host && onCommand && <form className="room-rename" onSubmit={(event) => { event.preventDefault(); void onCommand({ kind: "setRoomName", name: roomNameDraft }); }}>
        <label htmlFor="room-display-name">Room name</label>
        <input id="room-display-name" maxLength={48} value={roomNameDraft} onChange={(event) => setRoomNameDraft(event.target.value)} placeholder="Defaults to the invitation code" />
        <button type="submit" disabled={busy || (roomNameDraft.trim() || session.code) === session.summary.name}>Save name</button>
      </form>}
      <div className="invite-links">
        <button type="button" onClick={() => copy(`${window.location.origin}/?join=${session.code}`)}>Copy player invitation</button>
        <button type="button" onClick={() => copy(`${window.location.origin}/room/${session.code}?spectate=1`)}>Copy spectator link</button>
      </div>

      <section className="lobby-seat-stage" aria-label={`${seats.length} game seats`} data-seat-count={seats.length}>
        <div className="lobby-seat-core" aria-hidden="true">
          <img src="/horizon-logo.png" alt="" />
          <span>{session.summary.name}</span>
          <b>{session.code}</b>
          <small>{claimedHumans}/{humanSeats.length} commanders</small>
        </div>
        {seats.map((seat) => {
          const bot=seat.controller.kind==="bot", isMine=session.playerId===seat.playerId;
          const botProfileId=seat.controller.kind==="bot"?seat.controller.profileId:"";
          const angle=(-90+(seat.playerId*360/seats.length))*Math.PI/180;
          const seatZone=Math.sin(angle)<-0.8?"top":Math.sin(angle)>0.8?"bottom":"side";
          const interactive=session.summary.status==="lobby"&&((bot&&host)||(isMine&&!seat.ready));
          return <article key={seat.playerId} data-seat-zone={seatZone} className={`${seat.claimed?"claimed":"open"} ${isMine?"mine":""} ${interactive?"interactive":""}`} style={{"--seat-color":seat.faction?factionLibrary[seat.faction]?.color:"#4bdff3","--seat-x":`${50+42*Math.cos(angle)}%`,"--seat-y":`${50+39*Math.sin(angle)}%`} as React.CSSProperties}>
            <span>SEAT {seat.playerId+1}</span>
            <h3>{seat.faction?seat.civilization:bot&&seat.randomFaction?"Random faction":seat.claimed?"Choose faction":"Open human seat"}</h3>
            <button className="seat-orb" type="button" disabled={!interactive} onClick={()=>openFactionBrowser(seat.playerId)} aria-label={interactive?`Choose faction for seat ${seat.playerId+1}`:`Seat ${seat.playerId+1}`}>
              {seat.faction&&factionLibrary[seat.faction]?.logo?<img src={factionLibrary[seat.faction].logo} alt=""/>:bot&&seat.randomFaction?<b>?</b>:<i/>}
            </button>
            <small>{bot?(seat.displayName||"AI COMMANDER"):isMine?`${seat.displayName||"COMMANDER"} · YOUR SEAT`:seat.displayName||"WAITING FOR PLAYER"}</small>
            {host&&onCommand&&session.summary.status==="lobby"?<div className="seat-control-box">
              <select aria-label={`Controller for seat ${seat.playerId+1}`} value={bot?"bot":"human"} disabled={busy||isMine} onChange={(event)=>void onCommand(event.target.value==="bot"?{kind:"convertSeatToBot",playerId:seat.playerId,profileId:"ai-medium"}:{kind:"convertSeatToHuman",playerId:seat.playerId})}>
                <option value="human">Human</option><option value="bot">Bot</option>
              </select>
              {bot&&<select aria-label={`Difficulty for bot seat ${seat.playerId+1}`} disabled={busy} value={botProfileId} onChange={(event)=>void onCommand({kind:"setBotDifficulty",playerId:seat.playerId,profileId:event.target.value})}>
                {!botChallengeOptions.some(option=>option.id===botProfileId)&&<option value={botProfileId}>{botChallengeLabel(botProfileId)} (legacy)</option>}
                {botChallengeOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
              </select>}
            </div>:<div className="seat-control-box read-only"><span>{bot?"BOT":"HUMAN"}</span>{isMine&&<b>{seat.ready?"READY":"SELECT YOUR FACTION"}</b>}</div>}
          </article>;
        })}
      </section>

      <section className="premium-lobby-summary">
        <article><span>MAP</span><b>{map?.name || session.game.mapId}</b><small>{map?.description || "Installed content map"}</small></article>
        <article><span>FORMAT</span><b>{format?.name || session.game.format}</b><small>{format?.eras || 4} Eras</small></article>
        <article><span>CONTENT</span><b>{session.summary.enabledExpansions.includes("shattered-reach-expansion") ? "Shattered Reach enabled" : "Horizon Core Set"}</b><small>{session.summary.enabledExpansions.length ? "Host access grants every seat use of the enabled factions" : contentPacks.map((pack) => `${pack.id} ${pack.version}`).join(" · ") || "Core rules and civilizations"}</small></article>
        <article><span>LAUNCH STATUS</span><b>{allReady ? "All systems ready" : `${missingFaction + waitingHumans} requirement${missingFaction + waitingHumans === 1 ? "" : "s"} open`}</b><small>{missingFaction ? `${missingFaction} faction choice${missingFaction === 1 ? "" : "s"} missing` : waitingHumans ? `${waitingHumans} human seat${waitingHumans === 1 ? "" : "s"} waiting` : "Host may begin"}</small></article>
      </section>

      <section className="turn-timer-summary">
        <span>Turn timer</span>
        <b>{session.summary.turnTimerSeconds ? `${Math.round(session.summary.turnTimerSeconds / 60)} minutes` : "Disabled"}</b>
        <small>{session.summary.turnTimerSeconds ? "When time expires, each unsubmitted civilization's last valid saved draft is sealed. Hold is used only when no valid draft exists." : "Turns resolve after every civilization seals Orders."}</small>
      </section>

      {session.summary.status === "lobby" && session.summary.autoStartWhenReady && (
        <section className="auto-start-summary" role="status">
          <span>AUTOMATIC LAUNCH ENABLED</span>
          <b>The server will start this game when every human seat is claimed, has a faction, and is ready.</b>
          <small>{session.summary.turnTimerSeconds ? "The Turn timer begins immediately at launch, including when commanders have closed Horizon." : "The host may close Horizon. The final readiness update still starts the game."}</small>
        </section>
      )}

      {host && onCommand && session.summary.status === "lobby" && (
        <section className="auto-start-settings">
          <label>
            <input type="checkbox" checked={session.summary.autoStartWhenReady} disabled={busy} onChange={(event) => void onCommand({ kind: "setAutoStart", enabled: event.target.checked })} />
            <span><b>Start automatically when all humans are ready</b><small>Bot seats count as ready once they have a faction or are set to Random.</small></span>
          </label>
        </section>
      )}

      {host && onCommand && ["lobby", "paused"].includes(session.summary.status) && (
        <section className="turn-timer-settings">
          <label>Room Turn timer
            <select value={timerMinutes} disabled={busy} onChange={(event) => setTimerMinutes(event.target.value)}>
              <option value="0">No timer</option>
              {[1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 720, 1440, 2880].map((minutes) => <option value={minutes} key={minutes}>{minutes < 60 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} minutes`}</option>)}
            </select>
          </label>
          <button type="button" disabled={busy || (session.summary.turnTimerSeconds || 0) === Number(timerMinutes) * 60} onClick={() => void onCommand({ kind: "setTurnTimer", seconds: Number(timerMinutes) ? Number(timerMinutes) * 60 : null })}>Apply timer</button>
        </section>
      )}

      {onCommand && session.summary.status === "lobby" && mine?.controller.kind === "human" && (
        <section className="faction-draft faction-draft-compact">
          <div><span>YOUR FACTION</span><b>{mine.faction?mine.civilization:"Not selected"}</b><small>{mine.ready?"Your selection is locked. Clear Ready to change it.":"Select your glowing seat above to review faction dossiers."}</small></div>
          {!mine.ready&&<button type="button" onClick={()=>openFactionBrowser(mine.playerId)}>{mine.faction?"Change faction":"Choose faction"}</button>}
          <button type="button" className={`faction-ready-action ${mine.ready ? "ready" : ""}`} disabled={busy || (!mine.faction && !mine.ready)} onClick={() => void onCommand({ kind: "setReady", ready: !mine.ready })}>
            {mine.ready ? "Ready. Unlock seat" : mine.faction ? `Confirm ${mine.civilization}` : "Faction required"}
          </button>
        </section>
      )}

      {onCommand && session.summary.status === "lobby" && factionSeat && viewedFaction && (
        <div className="faction-browser-overlay" role="dialog" aria-modal="true" aria-label={`${viewedFaction.name} faction profile`} style={{ "--faction-color": viewedFaction.color } as React.CSSProperties}>
          <section className="faction-browser">
            <header>
              <div><span>FACTION ARCHIVE · SEAT {factionSeat.playerId+1}</span><b>{choosingForBot?"Choose the bot civilization":"Choose your civilization"}</b></div>
              <button type="button" onClick={closeFactionBrowser}>Return to lobby</button>
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
                <div><span>Learning curve</span><b>{factionGuides[viewedFaction.id]?.difficulty || "Varied"}</b></div>
              </section>
              {factionGuides[viewedFaction.id] && <section className="faction-profile-strategy"><h2>Command doctrine</h2><p>{factionGuides[viewedFaction.id].style}</p><h3>Opening priorities</h3><ol>{factionGuides[viewedFaction.id].opening.map((step) => <li key={step}>{step}</li>)}</ol><h3>Middle and late game</h3><p>{factionGuides[viewedFaction.id].midgame} {factionGuides[viewedFaction.id].lateGame}</p><h3>Watch for</h3><p>{factionGuides[viewedFaction.id].watchFor}</p></section>}
              <section className="faction-profile-objectives">
                <h2>Civilization Legacy</h2>
                <div>{(viewedFaction.objectives || []).map((objective, index) => <span key={objective}><i>{index + 1}</i><b>{objective}</b></span>)}</div>
              </section>
              <footer>
                <span>{viewedTaken ? `${viewedFaction.name} has already been chosen by seat ${viewedSelectedBy!.playerId + 1}.` : factionSeat.ready&&factionSeat.controller.kind==="human" ? "Unlock your Ready status before changing factions." : factionSeat.faction === viewedFaction.id ? "This is the current faction selection." : "This faction is available."}</span>
                <button type="button" className="primary" disabled={busy || (factionSeat.controller.kind==="human"&&factionSeat.ready) || viewedTaken || factionSeat.faction === viewedFaction.id} onClick={async () => { await onCommand(choosingForBot?{kind:"setBotFaction",playerId:factionSeat.playerId,random:false,factionId:viewedFaction.id}:{kind:"selectFaction",factionId:viewedFaction.id}); closeFactionBrowser(); }}>{factionSeat.faction === viewedFaction.id ? "Currently selected" : viewedTaken ? "Faction unavailable" : `Select ${viewedFaction.name}`}</button>
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
              {seat.faction && factionLibrary[seat.faction]?.logo && <img className="lobby-seat-logo" src={factionLibrary[seat.faction].logo} alt="" />}
              <b>
                {seat.faction ? seat.civilization : "Awaiting faction choice"}
                {mine ? " · YOU" : ""}
              </b>
              <small>
                {bot
                  ? `AI · ${botChallengeLabel(profileId || "")}`
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
              <span><b>{seat.faction ? seat.civilization : `Seat ${seat.playerId + 1}`}</b><small>{seat.controller.kind === "bot" ? `${botChallengeLabel(seat.controller.profileId)} · ${botChallengeOptions.find((option) => option.id === (seat.controller.kind === "bot" ? seat.controller.profileId : ""))?.description || "Existing saved bot profile"}` : seat.displayName || "Open seat"}</small></span>
              <span className="admin-seat-actions">
                {seat.controller.kind === "bot"
                  ? <><select aria-label={`Difficulty for bot seat ${seat.playerId+1}`} disabled={busy} value={seat.controller.profileId} onChange={(event)=>void onCommand({kind:"setBotDifficulty",playerId:seat.playerId,profileId:event.target.value})}>{!botChallengeOptions.some(option=>option.id===(seat.controller.kind==="bot"?seat.controller.profileId:""))&&<option value={seat.controller.profileId}>{botChallengeLabel(seat.controller.profileId)} (legacy)</option>}{botChallengeOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select><select aria-label={`Faction for bot seat ${seat.playerId+1}`} disabled={busy} value={seat.randomFaction?"random":seat.faction||"random"} onChange={(event)=>void onCommand(event.target.value==="random"?{kind:"setBotFaction",playerId:seat.playerId,random:true}:{kind:"setBotFaction",playerId:seat.playerId,random:false,factionId:event.target.value})}><option value="random">Random faction</option>{session.summary.availableFactions.map(faction=><option key={faction.id} value={faction.id} disabled={seats.some(candidate=>candidate.playerId!==seat.playerId&&candidate.faction===faction.id)}>{faction.name}</option>)}</select><button disabled={busy} onClick={() => void onCommand({ kind: "convertSeatToHuman", playerId: seat.playerId })}>Open to human</button></>
                  : <>
                    {seat.claimed && <button disabled={busy} onClick={() => void onCommand({ kind: "setSeatReady", playerId: seat.playerId, ready: !seat.ready })}>{seat.ready ? "Clear ready" : "Force ready"}</button>}
                    {seat.claimed && <button disabled={busy} onClick={() => void onCommand({ kind: "transferHost", playerId: seat.playerId })}>Transfer host</button>}
                    {seat.claimed && <button disabled={busy} onClick={() => void onCommand({ kind: "resetHumanSeat", playerId: seat.playerId })}>Reopen seat</button>}
                    <button disabled={busy} onClick={() => void onCommand({ kind: "convertSeatToBot", playerId: seat.playerId, profileId: "ai-medium" })}>Assign AI</button>
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
