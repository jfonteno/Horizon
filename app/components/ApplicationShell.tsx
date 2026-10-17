"use client";

import { useEffect, useMemo, useState } from "react";
import {
  factionLibrary,
  gameFormats,
  publicGameFormatIds,
  mapIds,
  mapLibrary,
  themeIds,
  themeLibrary,
  type ContentCatalog,
  type FactionId,
  type GameFormatId,
  type GameState,
  type RoomIdentity,
  type RoomSession,
  type ThemeId,
} from "../../game";
import HorizonCodex from "./HorizonCodex";
import { RoomSetup } from "./MultiplayerRooms";
import { useDirectionalNavigation } from "../lib/input";
import { beginProviderSignIn, createCommanderAccount, deleteCommanderAccount, deleteGames, downloadGameData, exportCommanderAccount, loadRecoveryKey, providerAvailability, recoverCommanderAccount, resumeCommanderAccount, revokeCommanderSession, revokeOtherCommanderSessions, rotateCommanderRecoveryKey, selectCommanderEmblem, signOutCommanderAccount, startEmailIdentity, unlinkCommanderIdentity, updateCloudPreferences, updateCommanderAccount, verifyEmailIdentity, type AccountSession, type IdentityProviders, type LinkedRoom } from "../lib/account-client";
import LobbySoundtrack from "./network/LobbySoundtrack";
import FactionAcademy from "./network/FactionAcademy";
import TechnologyPanel from "./TechnologyPanel";

type Screen = "home" | "games" | "create" | "join" | "academy" | "codex" | "technology" | "expansions" | "profile" | "settings";

type Props = {
  launchBusy?: boolean;
  contentCatalog: ContentCatalog | null;
  contentError: string;
  hasLocalGame: boolean;
  count: number;
  setCount: (value: number) => void;
  chosen: FactionId[];
  setChosen: (value: FactionId[]) => void;
  selectedMapId: string;
  setSelectedMapId: (value: string) => void;
  gameFormat: GameFormatId;
  setGameFormat: (value: GameFormatId) => void;
  theme: ThemeId;
  setTheme: (value: ThemeId) => void;
  seatControllers: string[];
  setSeatControllers: (value: string[]) => void;
  createLocal: () => void;
  runSimulation: () => void;
  gameFactory: () => GameState;
  startHost: (session: RoomSession) => void;
  openRemote: (session: RoomSession) => void;
  continueLocal: () => void;
  startTutorial: () => void;
  startFactionTraining?: (factionId: FactionId) => void;
  quickStart: () => void;
};

const plannedPacks = [
  {
    id: "core", name: "Horizon Core Set", status: "Included", stage: "enabled",
    description: "The complete base game, Standard System, core technologies, diplomacy, Legacy, and the Horizon Gate.",
    factions: ["Varkesh", "Helix", "Foundry", "Aurelians", "Meridian", "Farbound"],
    contents: "6 playable factions · 1 map",
  },
  {
    id: "shattered-reach", name: "Shattered Reach", status: "Expansion Playtest", stage: "enabled",
    description: "Asymmetric geography and civilizations built around fortification, mobility, ranged force, and concentrated development.",
    factions: ["Spires", "Aegis", "Wayfarers", "Salvo", "Guilds"],
    contents: "1 playable map · 5 playable factions",
  },
  {
    id: "web-of-worlds", name: "Web of Worlds", status: "Design Documented", stage: "planned",
    description: "Institutional civilizations that license capabilities, finance development, broker trade, enforce commitments, and build transit networks.",
    factions: ["Directorate", "Consortium", "Exchange", "Covenant", "Junction"],
    contents: "5 factions · implementation pending",
  },
  {
    id: "spoils-of-war", name: "Spoils of War", status: "Design Documented", stage: "planned",
    description: "The war economy expands through mass production, captured fleets, arms contracts, salvage, and distressed-asset markets.",
    factions: ["Fabricants", "Corsairs", "Arsenal", "Reclaimers", "Pawnbrokers"],
    contents: "5 factions · implementation pending",
  },
  {
    id: "beyond-known", name: "Beyond the Known", status: "Design Documented", stage: "planned",
    description: "Exploration, research, cooperation, and preservation take center stage alongside the larger Orrery system map.",
    factions: ["Seekers", "Scholarium", "Conclave", "Archivists"],
    contents: "4 factions · 1 planned map",
  },
  {
    id: "delegate-dawn", name: "Delegate Dawn", status: "Design Documented", stage: "planned",
    description: "A culture and diplomacy expansion with public Galactic Policies and an expanded Hidden Objective deck.",
    factions: ["Quintions", "Triumvirate", "Diaspora", "Muses"],
    contents: "4 factions · 2 rules modules",
  },
  {
    id: "hidden-hands", name: "Hidden Hands", status: "Design Documented", stage: "planned",
    description: "Indirect power through strategic reach, public wagers, incentivized directives, espionage, and private Intel.",
    factions: ["Vectors", "House", "Mandate", "Veil"],
    contents: "4 factions · implementation pending",
  },
];

const expansionFactionBriefs: Record<string, Record<string, string>> = {
  core: {
    Varkesh: "Fast military pressure and Glory earned through distinct victories.", Helix: "Research specialization and technology exchange.", Foundry: "Material efficiency, Prospectors, and accelerated construction.", Aurelians: "Influence conversion, Envoys, and agreement-driven diplomacy.", Meridian: "Trade brokerage and flexible commercial growth.", Farbound: "Private surveys, exploration intelligence, and frontier settlement.",
  },
  "shattered-reach": {
    Spires: "Concentrated vertical cities, Arcologies, and powerful Defense Grids.", Aegis: "Constructible Blockades, defensive infrastructure, and security exports.", Wayfarers: "Mobile Habitats that migrate with their Centers and caravan defenses.", Salvo: "Hex-targeted Bombardment and artillery coordination without extra raw damage.", Guilds: "Enhanced Centers, Factories, and tightly optimized production.",
  },
  "web-of-worlds": {
    Directorate: "Licenses institutional capabilities across diplomatic networks.", Consortium: "Finances development and turns long-term investment into leverage.", Exchange: "Creates liquid markets and profits from high-volume trade.", Covenant: "Makes commitments enforceable and rewards reliable agreements.", Junction: "Builds transit links that reshape distance and movement.",
  },
  "spoils-of-war": {
    Fabricants: "Mass-produces standardized military hulls.", Corsairs: "Boards vulnerable ships and captures noncombatants, including Colony Ships.", Arsenal: "Supplies arms contracts and benefits from other factions' wars.", Reclaimers: "Salvages destroyed fleets and converts wreckage into new strength.", Pawnbrokers: "Trades distressed assets and extracts value from military losses.",
  },
  "beyond-known": {
    Seekers: "Pushes farther into unrevealed space and rewards discovery.", Scholarium: "Builds research depth through specialized study.", Conclave: "Turns cooperative exploration into shared advantages.", Archivists: "Preserves discoveries and scores the accumulated record of the galaxy.",
  },
  "delegate-dawn": {
    Quintions: "Builds cultural coalitions around public policy.", Triumvirate: "Balances three internal power blocs for flexible bonuses.", Diaspora: "Gains strength from influence distributed across many worlds.", Muses: "Shapes objectives, reputation, and civilization-wide inspiration.",
  },
  "hidden-hands": {
    Vectors: "Projects strategic reach through indirect positioning.", House: "Makes public wagers and profits when predictions come true.", Mandate: "Issues incentivized directives that alter other players' choices.", Veil: "Uses espionage and private Intel to control uncertainty.",
  },
};

const commandBriefings = [
  {
    eyebrow: "GAME NEWS",
    title: "Closed Beta Command is live",
    body: "My Games keeps active and previous campaigns together across every signed-in device.",
    detail: "Release 0.35.4",
  },
  {
    eyebrow: "NEW FEATURES",
    title: "Review the complete campaign",
    body: "Finished games now include the Gate ledger, Legacy objectives, Turn timeline, private playtest feedback, and a fresh rematch lobby.",
    detail: "Match Review",
  },
  {
    eyebrow: "COMMAND SETTINGS",
    title: "Choose what gets your attention",
    body: "Notification categories and a color-accessible display mode help every commander tune the interface for longer multiplayer campaigns.",
    detail: "Per-device controls",
  },
  {
    eyebrow: "FEATURED",
    title: "First Horizon Academy",
    body: "Take faction classes at any time, then use the single Learn to Play entry in the command menu for a guided real match.",
    detail: "Commander training",
  },
] as const;

function readLastRoom(): RoomIdentity | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("horizon-room-identity-v1") || "null") as RoomIdentity | null; }
  catch { return null; }
}

function initialScreen(): Screen {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("join")) return "join";
  return "home";
}

function installedDisplayMode() {
  return typeof window!=="undefined"&&["fullscreen","standalone","minimal-ui"].some(mode=>window.matchMedia?.(`(display-mode: ${mode})`).matches);
}

function readSettings() {
  const defaults = { reducedMotion: false, largerText: false, highContrast: false, colorAccessible: false, musicMuted: false, musicVolume: 35, soundMuted: false, soundVolume: 35, notifyTurns: true, notifyMessages: true, notifyProposals: true, notifyDeadlines: true };
  if (typeof window === "undefined") return defaults;
  try {
    const legacyMusic=JSON.parse(localStorage.getItem("horizon-lobby-music-v1")||"null");
    return { ...defaults, ...(legacyMusic?.muted===true?{musicMuted:true}:{}), ...JSON.parse(localStorage.getItem("horizon-settings-v1") || "null") };
  }
  catch { return defaults; }
}

function shouldShowWelcome() {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem("horizon-onboarding-v1");
}

function ShellIcon({ name }: { name: Screen | "continue" | "solo" | "learn" | "quick" }) {
  const paths: Record<string, string> = {
    home: "M4 11 12 4l8 7v9h-6v-6h-4v6H4z",
    create: "M12 3v18M3 12h18",
    join: "M4 12h13m-5-5 5 5-5 5M4 5v14",
    academy: "M4 5h7a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3zm10 3a3 3 0 0 1 3-3h3v12a3 3 0 0 1-3 3h-3",
    codex: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM8 4v16",
    technology: "M3 6h18M3 12h18M3 18h18M7 3v18m10-18v18",
    expansions: "M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0-5 2 3 4-1 1 4 3 2-2 3 2 3-3 2-1 4-4-1-2 3-2-3-4 1-1-4-3-2 2-3z",
    profile: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M5 21c0-4 3-7 7-7s7 3 7 7",
    games: "M4 5h16v14H4zM8 9h8M8 13h5",
    continue: "M8 5v14l11-7z",
    solo: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M5 21c0-4 3-7 7-7s7 3 7 7",
    learn: "M4 5h7a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3zm10 3a3 3 0 0 1 3-3h3v12a3 3 0 0 1-3 3h-3",
    quick: "M13 2 5 14h6l-1 8 9-13h-6z",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function ApplicationShell(props: Props) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [shatteredReachEnabled, setShatteredReachEnabled] = useState(true);
  const [showWelcome, setShowWelcome] = useState(shouldShowWelcome);
  const [lastRoom,setLastRoom] = useState<RoomIdentity | null>(readLastRoom);
  const [settings, setSettings] = useState(readSettings);
  const [briefingIndex, setBriefingIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [accountSession,setAccountSession]=useState<AccountSession|null>(null);
  const [profileError,setProfileError]=useState("");
  useEffect(()=>{const timer=window.setTimeout(()=>{const query=new URLSearchParams(window.location.search),requested=query.get("open");if(requested==="create"||requested==="join"||requested==="profile"||requested==="settings"||requested==="games")setScreen(requested);else if(requested==="continue"){const room=readLastRoom();if(room)window.location.assign(`/room/${room.code}`);}else if(query.get("join"))setScreen("join");},0);return()=>window.clearTimeout(timer);},[]);
  useEffect(() => {
    document.documentElement.dataset.motion = settings.reducedMotion ? "reduced" : "full";
    document.documentElement.dataset.text = settings.largerText ? "large" : "standard";
    document.documentElement.dataset.contrast = settings.highContrast ? "high" : "standard";
    document.documentElement.dataset.color = settings.colorAccessible ? "accessible" : "standard";
    localStorage.setItem("horizon-settings-v1", JSON.stringify(settings));
    localStorage.setItem("horizon-lobby-music-v1",JSON.stringify({muted:settings.musicMuted}));
    window.dispatchEvent(new Event("horizon-settings-changed"));
    const cloudTimer=window.setTimeout(()=>void updateCloudPreferences(settings).catch(()=>undefined),700);
    return()=>window.clearTimeout(cloudTimer);
  }, [settings]);
  useEffect(()=>{ void resumeCommanderAccount().then(value=>{setAccountSession(value);setSettings((current:ReturnType<typeof readSettings>)=>({...current,...value.preferences}));}).catch(()=>undefined); },[]);
  useEffect(() => {
    const syncSoundtrack = () => setSettings(readSettings());
    window.addEventListener("horizon-soundtrack-changed", syncSoundtrack);
    return () => window.removeEventListener("horizon-soundtrack-changed", syncSoundtrack);
  }, []);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const installed = useMemo(() => props.contentCatalog?.packs || [], [props.contentCatalog]);
  const nav = (next: Screen) => setScreen(next);
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
  };
  const briefing = commandBriefings[briefingIndex];
  useDirectionalNavigation(".horizon-shell");

  return <main id="main-content" className="horizon-shell" data-screen={screen}>
    <div className="shell-stars" /><div className="shell-nebula" />
    <header className="shell-topbar">
      <button className="shell-brand" onClick={() => nav("home")} aria-label="Horizon home"><img src="/horizon-logo.png" alt="Horizon: Shattered Reach" /></button>
      <div className="shell-network"><i /><span>Horizon Network</span><b>{props.contentError ? "Attention required" : "Online"}</b></div>
      <button type="button" className="shell-fullscreen" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}><span aria-hidden="true">{fullscreen ? "⊙" : "⛶"}</span></button>
      <button type="button" className="shell-profile" onClick={() => nav("profile")} title="Open Commander Profile"><span>{accountSession?.account.displayName||"Create Commander"}</span><b>{accountSession?"COMMANDER PROFILE":"SIGN IN OR REGISTER"}</b><i>{accountSession?.account.emblems.selected&&accountSession.account.emblems.selected!=="horizon"&&factionLibrary[accountSession.account.emblems.selected]?.logo?<img src={factionLibrary[accountSession.account.emblems.selected].logo} alt=""/>:(accountSession?.account.displayName||"HC").split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()}</i></button>
      {accountSession?.account.roles.some(role=>role==="owner"||role==="admin"||role==="support"||role==="analyst")&&<a className="shell-operations-link" href="/admin">Operations</a>}
    </header>
    <LobbySoundtrack />
    {props.launchBusy && <p className="shell-command-error" role="status">Preparing your command board…</p>}
    {screen === "home" && props.contentError && <p className="shell-command-error" role="alert">{props.contentError}</p>}

    {screen === "home" && <div className="shell-home">
      <nav className="shell-primary-nav" aria-label="Main menu">
        <span>COMMAND INTERFACE</span>
        <button className={accountSession?.rooms.some(room=>room.attentionCount>0&&room.status!=="complete")?"continue":""} onClick={() => nav("games")}><ShellIcon name="games" /><span><b>My Games</b><small>Active and previous games{accountSession?.rooms.some(room=>room.attentionCount>0&&room.status!=="complete")?` · ${accountSession.rooms.reduce((sum,room)=>sum+(room.status!=="complete"?room.attentionCount:0),0)} actions`:""}</small></span></button>
        <button className="learn" disabled={props.launchBusy} onClick={() => nav("academy")}><ShellIcon name="learn" /><span><b>Horizon Academy</b><small>Learn to Play and train with all 11 factions</small></span></button>
        <button disabled={props.launchBusy} onClick={props.quickStart}><ShellIcon name="quick" /><span><b>Quick Start</b><small>Random faction and map with 3–5 AI civilizations</small></span></button>
        <button onClick={() => nav("create")}><ShellIcon name="create" /><span><b>Create Game</b><small>Configure a new system</small></span></button>
        <button onClick={() => nav("join")}><ShellIcon name="join" /><span><b>Join Game</b><small>Enter an invitation code</small></span></button>
        <button disabled={props.launchBusy} onClick={props.runSimulation}><ShellIcon name="solo" /><span><b>Solo Simulation</b><small>Observe six Emperor bots</small></span></button>
        <button onClick={() => nav("codex")}><ShellIcon name="codex" /><span><b>Horizon Codex</b><small>Search rules, terms, and civilizations</small></span></button>
        <button className="menu-technology" onClick={() => nav("technology")}><ShellIcon name="technology" /><span><b>Technology Tree</b><small>Explore every branch and level</small></span></button>
        <button onClick={() => nav("expansions")}><ShellIcon name="expansions" /><span><b>Future Content</b><small>Core content and long-term concepts</small></span></button>
      </nav>
      <section className="shell-hero">
        <div className="gate-orbit"><i /><i /><i /><span /></div>
        <p>THE SYSTEM IS FRACTURED</p><h1>Every civilization leaves a legacy.</h1>
        <p className="shell-hero-copy">Explore, negotiate, build, and command through simultaneous Orders. Complete the Horizon Gate together while competing to define the future of the system.</p>
        <div className="shell-hero-actions"><button className="premium-primary" onClick={() => nav("create")}>Create a Game</button><button disabled={props.launchBusy} onClick={props.quickStart}>Quick Start</button></div>
        <div className="shell-release"><span>SHATTERED REACH</span><b>0.35.4</b><small>{installed.length ? `${installed.length} external content pack${installed.length === 1 ? "" : "s"} loaded` : "Gameplay balance playtest"}</small></div>
      </section>
      <aside className="shell-news" aria-label="Horizon briefing">
        <span>{briefing.eyebrow}</span><h2>{briefing.title}</h2><p>{briefing.body}</p><small>{briefing.detail}</small>
        <nav aria-label="Briefing categories">{commandBriefings.map((item,index)=><button type="button" key={item.eyebrow} className={briefingIndex===index?"active":""} onClick={()=>setBriefingIndex(index)} aria-label={`Show ${item.eyebrow.toLowerCase()}`}>{index+1}</button>)}</nav>
      </aside>
    </div>}

    {screen === "games" && <ShellScreen title="My Games" eyebrow="COMMANDER CONTINUITY" back={() => nav("home")}><GameLibrary session={accountSession} setSession={setAccountSession} lastRoom={lastRoom} onRoomsRemoved={codes=>{if(lastRoom&&codes.includes(lastRoom.code)){localStorage.removeItem("horizon-room-identity-v1");setLastRoom(null);}}} hasLocalGame={props.hasLocalGame} continueLocal={props.continueLocal} launchBusy={props.launchBusy} /></ShellScreen>}

    {screen === "create" && <ShellScreen title="Create Game" eyebrow="ROOM CONFIGURATION" back={() => nav("home")}>
      <div className="single-page-creation">
        <section><header><span>01</span><div><h2>Game format</h2><p>Choose the campaign length.</p></div></header><div className="choice-grid formats">{publicGameFormatIds.map((id) => <button key={id} className={props.gameFormat === id ? "selected" : ""} onClick={() => props.setGameFormat(id)}><span>{id === "four-era" ? "STANDARD" : "EXTENDED"}</span><h2>{gameFormats[id].name}</h2><p>{gameFormats[id].eras} Eras of simultaneous play.</p></button>)}</div></section>
        <section><header><span>02</span><div><h2>Map</h2><p>Select the strategic board.</p></div></header><div className="choice-grid maps">{mapIds.map((id) => { const map=mapLibrary[id],locked=Boolean(map.sourcePack)&&!shatteredReachEnabled; return <button key={id} disabled={locked} className={props.selectedMapId === id ? "selected" : ""} onClick={() => props.setSelectedMapId(id)}><div className="map-miniature" data-map={id}><span /></div><span>{locked?"EXPANSION DISABLED":map.sourcePack?"SHATTERED REACH":"CORE MAP"}</span><h2>{map.name}</h2><p>{map.description}</p><small>{map.minPlayers || 4}–{map.maxPlayers || 6} players</small></button>; })}</div></section>
        <section><header><span>03</span><div><h2>Expansions</h2><p>Enabled content is shared with every seat for this match.</p></div></header><div className="expansion-checklist"><label className="owned"><input type="checkbox" checked readOnly/><span><b>Horizon Core Set</b><small>Included with every game</small></span></label><label className="owned"><input type="checkbox" checked={shatteredReachEnabled} onChange={event=>{setShatteredReachEnabled(event.target.checked);if(!event.target.checked&&mapLibrary[props.selectedMapId].sourcePack)props.setSelectedMapId("standard-board")}}/><span><b>Shattered Reach</b><small>Owned · 5 factions and 1 map</small></span></label>{plannedPacks.slice(2).map(pack=><label className="locked" key={pack.id}><input type="checkbox" disabled/><span><b>{pack.name}</b><small>Not yet available</small></span></label>)}</div></section>
        <section><header><span>04</span><div><h2>Seats</h2><p>The host assigns human or bot control in the next room.</p></div></header><div className="large-segments">{[4,5,6].map(value=><button key={value} className={props.count===value?"selected":""} onClick={()=>props.setCount(value)}><b>{value}</b><span>Seats</span></button>)}</div></section>
        <section className="creation-launch"><header><span>05</span><div><h2>Launch</h2><p>{gameFormats[props.gameFormat].name} · {mapLibrary[props.selectedMapId].name} · {props.count} seats</p></div></header><div className="creation-launches"><button className="premium-primary" disabled={props.launchBusy} onClick={props.createLocal}>Begin Local Game</button><RoomSetup view="host" gameFactory={()=>{const next=props.gameFactory();next.enabledExpansions=shatteredReachEnabled?["shattered-reach-expansion"]:[];return next}} startHost={props.startHost} openRemote={props.openRemote} /></div></section>
      </div>
    </ShellScreen>}

    {screen === "join" && <ShellScreen title="Join Game" eyebrow="HORIZON NETWORK" back={() => nav("home")}><div className="join-premium"><section><span>PRIVATE NETWORK SESSION</span><h2>Enter the invitation provided by your host.</h2><p>Claim an open seat, choose your civilization, and confirm readiness from the room lobby. Existing players can resume from the main menu.</p></section><RoomSetup view="join" gameFactory={props.gameFactory} startHost={props.startHost} openRemote={props.openRemote} /></div></ShellScreen>}

    {screen === "academy" && <ShellScreen title="Horizon Academy" eyebrow="COMMANDER TRAINING" back={() => nav("home")}><div className="academy-fundamentals"><section><span>FOUNDATIONS COURSE</span><h2>First Horizon</h2><p>Learn the shared rules in a guided eight-Turn Foundry match covering Legacy, exploration, settlement, development, the Gate, diplomacy, and combat.</p><button className="premium-primary" disabled={props.launchBusy} onClick={props.startTutorial}>Begin First Horizon</button><small>About 30 minutes · recommended for new commanders</small></section></div><FactionAcademy startTraining={props.startFactionTraining} /></ShellScreen>}

    {screen === "codex" && <ShellScreen title="Horizon Codex" eyebrow="RULES AND CIVILIZATION ARCHIVE" back={() => nav("home")}><HorizonCodex /></ShellScreen>}
    {screen === "technology" && <ShellScreen title="Technology Tree" eyebrow="RESEARCH ARCHIVE" back={() => nav("home")}><TechnologyPanel mode="browse"/></ShellScreen>}

    {screen === "expansions" && <ShellScreen title="Expansions" eyebrow="CONTENT ARCHIVE" back={() => nav("home")}><ExpansionArchive catalog={props.contentCatalog}/></ShellScreen>}

    {screen === "profile" && <ShellScreen title="Commander Profile" eyebrow="HORIZON IDENTITY" back={() => nav("home")}><div className="commander-profile-page">{profileError && <section role="alert" className="profile-alert"><p>{profileError}</p><button onClick={()=>void resumeCommanderAccount().then(value=>{setAccountSession(value);setProfileError("");}).catch(()=>setProfileError("Profile could not be loaded. Your recovery key remains saved."))}>Retry profile</button></section>}<AccountPanel key={`${accountSession?.account.id || "signed-out"}:${accountSession?.account.updatedAt || ""}`} session={accountSession} setSession={setAccountSession}/></div></ShellScreen>}

    {screen === "settings" && <ShellScreen title="Settings" eyebrow="COMMAND INTERFACE" back={() => nav("home")}><div className="settings-grid"><section className="settings-status"><span>COMMANDER PROFILE</span><b>{accountSession?.account.displayName||"Not signed in"}</b><button type="button" onClick={()=>nav("profile")}>{accountSession?"Manage profile":"Create or sign in"}</button><small>Identity, statistics, emblems, linked accounts, and devices.</small></section><SettingToggle name="Reduced motion" detail="Replace animated transitions with simple fades." value={settings.reducedMotion} setValue={value=>setSettings({...settings,reducedMotion:value})}/><SettingToggle name="Larger interface text" detail="Increase menu and information text size." value={settings.largerText} setValue={value=>setSettings({...settings,largerText:value})}/><SettingToggle name="High contrast" detail="Strengthen borders, focus states, and interface text contrast." value={settings.highContrast} setValue={value=>setSettings({...settings,highContrast:value})}/><SettingToggle name="Color-accessible markers" detail="Add shape and border differences anywhere faction colors carry meaning." value={settings.colorAccessible} setValue={value=>setSettings({...settings,colorAccessible:value})}/><SettingToggle name="Turn reminders" detail="Notify when your Orders or mandatory decisions need attention." value={settings.notifyTurns} setValue={value=>setSettings({...settings,notifyTurns:value})}/><SettingToggle name="Message reminders" detail="Notify about unread direct and group messages." value={settings.notifyMessages} setValue={value=>setSettings({...settings,notifyMessages:value})}/><SettingToggle name="Proposal reminders" detail="Notify when a trade or diplomatic proposal needs a response." value={settings.notifyProposals} setValue={value=>setSettings({...settings,notifyProposals:value})}/><SettingToggle name="Deadline reminders" detail="Include room timer deadlines in attention notifications." value={settings.notifyDeadlines} setValue={value=>setSettings({...settings,notifyDeadlines:value})}/><SettingToggle name="Soundtrack" detail="Play menu music and Tactical Focus during matches." value={!settings.musicMuted} setValue={value=>setSettings({...settings,musicMuted:!value})}/><SettingRange name="Music volume" detail="Set the soundtrack level in menus and matches." value={settings.musicVolume} disabled={settings.musicMuted} setValue={value=>setSettings({...settings,musicVolume:value})}/><SettingToggle name="Interface click sound" detail="Play Single Click on interactive controls." value={!settings.soundMuted} setValue={value=>setSettings({...settings,soundMuted:!value})}/><SettingRange name="Click volume" detail="Set the basic interface click level." value={settings.soundVolume} disabled={settings.soundMuted} setValue={value=>setSettings({...settings,soundVolume:value})}/><section className="settings-status theme-setting"><span>VISUAL PACKAGE</span><div>{themeIds.map(id=><button key={id} className={props.theme === id ? "selected" : ""} onClick={()=>props.setTheme(id)}>{themeLibrary[id].name}</button>)}</div><small>Applied to new local and network games.</small></section><section className="settings-status"><span>DISPLAY MODE</span><b>{installedDisplayMode()?"Installed application":"Browser"}</b><button type="button" onClick={()=>void document.documentElement.requestFullscreen?.()}>Enter fullscreen</button><small>Install Horizon from the application prompt for a dedicated window.</small></section><section className="settings-status"><span>CONTENT STATUS</span><b>{props.contentError ? "Attention required" : "Validated"}</b><small>{props.contentError || "Core content and installed manifests are ready."}</small></section><section className="settings-status privacy-links"><span>PRIVACY AND SUPPORT</span><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:support@horizongame.us">Support</a></div><small>Profile export and deletion are available in Commander Profile.</small></section></div></ShellScreen>}

    {showWelcome && <div className="onboarding-welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><article><span>WELCOME, COMMANDER</span><h1 id="welcome-title">Your first Horizon begins here.</h1><p>Learn the complete game through an eight-Turn guided scenario, or continue directly to the command interface.</p><button className="premium-primary" onClick={() => { localStorage.setItem("horizon-onboarding-v1",JSON.stringify({started:true,completed:false,dismissed:false,step:0})); setShowWelcome(false); props.startTutorial(); }}>Learn to Play</button><button onClick={() => { localStorage.setItem("horizon-onboarding-v1",JSON.stringify({started:false,completed:false,dismissed:true,step:0})); setShowWelcome(false); }}>Open Main Menu</button></article></div>}
    <footer className="shell-footer"><span>HORIZON 0.35.4</span><span>SHATTERED REACH</span><button type="button" onClick={() => void toggleFullscreen()}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</button><button type="button" onClick={() => nav("settings")}><ShellIcon name="settings" /> Settings</button></footer>
  </main>;
}

function ShellScreen({title,eyebrow,back,children}:{title:string;eyebrow:string;back:()=>void;children:React.ReactNode}) {
  return <section className="shell-screen"><header><button onClick={back} aria-label="Go back">‹</button><div><span>{eyebrow}</span><h1>{title}</h1></div></header><div className="shell-screen-scroll">{children}</div></section>;
}

function SettingToggle({name,detail,value,setValue}:{name:string;detail:string;value:boolean;setValue:(value:boolean)=>void}) {
  return <button className="setting-toggle" aria-pressed={value} onClick={()=>setValue(!value)}><span><b>{name}</b><small>{detail}</small></span><i>{value ? "ON" : "OFF"}</i></button>;
}

function SettingRange({name,detail,value,disabled,setValue}:{name:string;detail:string;value:number;disabled?:boolean;setValue:(value:number)=>void}) {
  return <label className="setting-range"><span><b>{name}</b><small>{detail}</small></span><input aria-label={name} type="range" min="0" max="100" step="5" value={value} disabled={disabled} onChange={event=>setValue(Number(event.target.value))}/><i>{value}%</i></label>;
}

function GameLibrary({session,setSession,lastRoom,onRoomsRemoved,hasLocalGame,continueLocal,launchBusy}:{session:AccountSession|null;setSession:(value:AccountSession)=>void;lastRoom:RoomIdentity|null;onRoomsRemoved:(codes:string[])=>void;hasLocalGame:boolean;continueLocal:()=>void;launchBusy?:boolean}) {
  const [selected,setSelected]=useState<string[]>([]);
  const [pending,setPending]=useState<LinkedRoom[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const deviceRoom = !session ? lastRoom : null;
  const refresh=async()=>{const next=await resumeCommanderAccount();setSession(next);setSelected(current=>current.filter(code=>next.rooms.some(room=>room.code===code)));};
  const run=async(task:()=>Promise<void>)=>{setBusy(true);setMessage("");try{await task();}catch(error){setMessage(error instanceof Error?error.message:"Game action failed.");}finally{setBusy(false);}};
  if(!session) return <div className="game-library"><section><h3>Active games</h3><div>{hasLocalGame&&<article data-status="active"><div><span>DEVICE SAVE</span><h4>Local Game</h4><p>Saved on this device</p></div><aside><button disabled={launchBusy} onClick={continueLocal}>Open game</button></aside></article>}{deviceRoom&&<article data-status="active"><div><span>ROOM {deviceRoom.code}</span><h4>{deviceRoom.code}</h4><p>Room access saved on this device</p></div><aside><button onClick={()=>window.location.assign(`/room/${deviceRoom.code}`)}>Open game</button></aside></article>}</div></section><section className="game-library-empty"><span>COMMANDER PROFILE REQUIRED</span><h2>Link every game across devices.</h2><p>Create or recover a Commander Profile to keep multiple games here.</p><button onClick={()=>window.location.assign("/?open=profile")}>Open Commander Profile</button></section></div>;
  const active = session.rooms.filter(room=>room.status!=="complete").sort((a,b)=>b.attentionCount-a.attentionCount||b.updatedAt.localeCompare(a.updatedAt));
  const complete = session.rooms.filter(room=>room.status==="complete").sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const selectedRooms=session.rooms.filter(room=>selected.includes(room.code));
  const toggle=(code:string)=>setSelected(current=>current.includes(code)?current.filter(item=>item!==code):[...current,code]);
  const row=(room:LinkedRoom)=><article key={room.code} data-status={room.status}>
    <label className="game-library-select"><input type="checkbox" checked={selected.includes(room.code)} onChange={()=>toggle(room.code)} aria-label={`Select ${room.roomName||room.code}`} /></label>
    <div><span>ROOM {room.code}</span><h4>{room.roomName||room.code}</h4><p>{room.role.toUpperCase()} · Era {room.era}, Turn {room.turn} · {room.status==="complete"?"Completed":room.status}</p><small>Updated {new Date(room.updatedAt).toLocaleString()}</small></div>
    <aside>{room.attentionCount>0&&<mark>{room.attentionCount} action{room.attentionCount===1?"":"s"}</mark>}{room.turnDeadlineAt&&room.status==="active"&&<small>Deadline {new Date(room.turnDeadlineAt).toLocaleString()}</small>}
      <div className="game-library-actions"><button onClick={()=>window.location.assign(`/room/${room.code}?recover=1`)}>{room.status==="complete"?"Review":"Open"}</button><button disabled={busy} onClick={()=>void run(()=>downloadGameData([room.code]))}>Download Data</button><button disabled={busy} onClick={()=>setPending([room])}>Delete</button></div></aside>
  </article>;
  return <div className="game-library"><header><div><span>COMMANDER {session.account.id}</span><h2>{active.length} active · {complete.length} completed</h2></div><button disabled={busy} onClick={()=>void run(refresh)}>Refresh games</button></header>
    {message&&<p className="game-library-message" role="status">{message}</p>}
    <div className="game-library-toolbar"><label><input type="checkbox" checked={session.rooms.length>0&&selected.length===session.rooms.length} onChange={event=>setSelected(event.target.checked?session.rooms.map(room=>room.code):[])} /> Select all games</label><span>{selected.length} selected</span><button disabled={busy||!selected.length} onClick={()=>void run(()=>downloadGameData(selected))}>Download Data</button><button disabled={busy||!selected.length} onClick={()=>setPending(selectedRooms)}>Delete</button></div>
    <section><h3>Active games ({active.length})</h3><div>{hasLocalGame&&<article data-status="active"><div><span>DEVICE SAVE</span><h4>Local Game</h4><p>Saved on this device</p></div><aside><button disabled={launchBusy} onClick={continueLocal}>Open game</button></aside></article>}{deviceRoom&&<article data-status="active"><div><span>ROOM {deviceRoom.code}</span><h4>{deviceRoom.code}</h4><p>Room access saved on this device</p></div><aside><button onClick={()=>window.location.assign(`/room/${deviceRoom.code}`)}>Open game</button></aside></article>}{active.map(row)}{!active.length&&!hasLocalGame&&!deviceRoom&&<p className="game-library-empty">No active games.</p>}</div></section>
    <details className="game-library-completed"><summary>Completed games ({complete.length})</summary><div>{complete.map(row)}{!complete.length&&<p className="game-library-empty">No completed games.</p>}</div></details>
    {pending&&<div className="game-library-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-games-heading"><div><h2 id="delete-games-heading">Delete {pending.length} game{pending.length===1?"":"s"}?</h2><p>{pending.some(room=>room.role==="host")?"Host rooms will be permanently deleted for every player. Other selected games will be removed from your list only.":"These games will be removed from your list. The host and other players will keep access."}</p><p>Download Data first if you want a copy. This action cannot be undone.</p><div><button disabled={busy} onClick={()=>setPending(null)}>Cancel</button><button className="danger" disabled={busy} onClick={()=>void run(async()=>{const codes=pending.map(room=>room.code);const result=await deleteGames(codes);onRoomsRemoved([...result.deleted,...result.hidden]);setPending(null);await refresh();setMessage(`${result.deleted.length} deleted, ${result.hidden.length} removed from your list.${result.conflicts.length?` ${result.conflicts.length} changed during deletion; refresh and retry.`:""}`);})}>{busy?"Deleting…":"Delete games"}</button></div></div></div>}
  </div>;
}

function AccountPanel({session,setSession}:{session:AccountSession|null;setSession:(session:AccountSession|null)=>void}) {
  const [name,setName]=useState(session?.account.displayName||"");
  const [recovery,setRecovery]=useState("");
  const [providers,setProviders]=useState<IdentityProviders>({email:false,emailDelivery:"disabled",apple:false,google:false,steam:false});
  const [email,setEmail]=useState("");
  const [emailCode,setEmailCode]=useState("");
  const [emailPending,setEmailPending]=useState(false);
  const [maskedEmail,setMaskedEmail]=useState("");
  const [emailDelivery,setEmailDelivery]=useState<"email"|"server-console">("email");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{void providerAvailability().then(setProviders);},[]);
  const run=async(task:()=>Promise<void>)=>{setBusy(true);setMessage("");try{await task();}catch(error){setMessage(error instanceof Error?error.message:"Identity request failed.");}finally{setBusy(false)}};
  const returnTo=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("returnTo"):null;
  const finish=(next:AccountSession)=>{setSession(next);if(returnTo?.startsWith("/"))window.location.assign(returnTo);};
  const destination=returnTo?.startsWith("/")?returnTo:"/?open=profile";
  const providerButtons=(mode:"signin"|"link")=><div className="identity-providers">{(["google","steam","apple"] as const).map(provider=><button key={provider} disabled={!providers[provider]||busy} onClick={()=>beginProviderSignIn(provider,mode,destination)}>{providers[provider]?`${mode==="link"?"Link":"Continue with"} ${provider[0].toUpperCase()+provider.slice(1)}`:`${provider[0].toUpperCase()+provider.slice(1)} unavailable`}</button>)}</div>;
  const emailForm=(mode:"signin"|"link")=><div className="email-identity-form">
    <label><span>Email address</span><input type="email" autoComplete="email" value={email} disabled={busy||emailPending} onChange={event=>setEmail(event.target.value)} placeholder="commander@example.com"/></label>
    {!emailPending?<button className="primary" disabled={busy||!providers.email||!email.trim()} onClick={()=>void run(async()=>{const result=await startEmailIdentity(email,mode,destination);setMaskedEmail(result.maskedEmail||email);setEmailDelivery(result.delivery||"email");setEmailPending(true);setMessage(result.delivery==="server-console"?"Testing mode: retrieve the verification code from the Horizon Server window.":`A verification code was sent to ${result.maskedEmail}.`);})}>{mode==="link"?"Add email":"Continue with email"}</button>:<>
      <label><span>Eight-digit code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={emailCode} onChange={event=>setEmailCode(event.target.value.replace(/\D/g,"").slice(0,8))} placeholder="00000000"/></label>
      {mode==="signin"&&<label><span>Commander name <small>Used only for a new account</small></span><input maxLength={40} value={name} onChange={event=>setName(event.target.value)} placeholder="Commander name"/></label>}
      <button className="primary" disabled={busy||emailCode.length!==8} onClick={()=>void run(async()=>{await verifyEmailIdentity(emailCode,name);const next=await resumeCommanderAccount();setEmailPending(false);setEmailCode("");finish(next);})}>Verify {maskedEmail}</button>
      <button disabled={busy} onClick={()=>{setEmailPending(false);setEmailCode("");setMessage("");}}>Use another email</button>
      {emailDelivery==="server-console"&&<small className="test-delivery-note">Verification is in server-console testing mode.</small>}
    </>}
    {!providers.email&&<small>Email verification is not configured on this server. Google, Steam, Apple, or recovery-key access can still be used when available.</small>}
  </div>;
  if(!session) return <section className="account-panel account-entry">
    <header><span>COMMANDER IDENTITY</span><h2>Create or access your Commander.</h2><p>One account carries your rooms, statistics, emblems, settings, and expansion access between devices.</p></header>
    <div className="account-entry-grid"><section><h3>Email verification</h3>{emailForm("signin")}</section><section><h3>Connected accounts</h3>{providerButtons("signin")}<small>Only providers configured by this Horizon server can be selected.</small></section></div>
    <details className="account-recovery-tools"><summary>Recovery and testing options</summary><p>Already have a Horizon recovery key? Use it here. A recovery-only profile is also available for local account testing, but should be linked to an email or platform before playing across devices.</p><div className="account-recovery"><input value={recovery} onChange={event=>setRecovery(event.target.value)} placeholder="Horizon recovery key"/><button disabled={busy||!recovery.trim()} onClick={()=>void run(async()=>finish(await recoverCommanderAccount(recovery.trim())))}>Recover profile</button></div><div className="account-recovery"><input value={name} onChange={event=>setName(event.target.value)} maxLength={40} placeholder="Commander name"/><button disabled={busy||!name.trim()} onClick={()=>void run(async()=>finish(await createCommanderAccount(name)))}>Create recovery-only profile</button></div></details>
    {message&&<p className="profile-message" role="status">{message}</p>}
  </section>;
  const stats=session.account.statistics;
  const winRate=stats.gamesCompleted?Math.round((stats.wins/stats.gamesCompleted)*100):0;
  const selected=session.account.emblems.selected;
  const selectedFaction=selected==="horizon"?null:factionLibrary[selected];
  const factions=Object.entries(factionLibrary).filter(([,faction])=>!faction.sourcePack||faction.sourcePack==="shattered-reach-expansion");
  return <section className="account-panel active commander-profile-layout">
    <header className="commander-profile-hero"><div className="profile-emblem">{selectedFaction?.logo?<img src={selectedFaction.logo} alt={`${selectedFaction.name} emblem`}/>:<img src="/horizon-logo.png" alt="Horizon Commander emblem"/>}</div><div><span>COMMANDER {session.account.id}</span><h2>{session.account.displayName}</h2><p>Member since {new Date(session.account.createdAt).toLocaleDateString()} · {session.rooms.length} linked game{session.rooms.length===1?"":"s"}</p></div><button onClick={()=>window.location.assign("/?open=games")}>Open My Games</button></header>
    {session.account.forceRename&&<p className="profile-message attention" role="alert">Horizon Operations requires a new display name before public play.</p>}
    <section className="profile-section"><header><span>CAREER RECORD</span><h3>Commander statistics</h3></header><div className="commander-statistics"><span><small>Completed</small><b>{stats.gamesCompleted}</b></span><span><small>Victories</small><b>{stats.wins}</b></span><span><small>Win rate</small><b>{winRate}%</b></span><span><small>Highest LP</small><b>{stats.highestLegacy}</b></span><span><small>Gate successes</small><b>{stats.gateSuccesses}</b></span><span><small>Total LP</small><b>{stats.totalLegacy}</b></span><span><small>Trades</small><b>{stats.totalTrades}</b></span><span><small>Combat wins</small><b>{stats.totalCombatWins}</b></span></div></section>
    <section className="profile-section"><header><span>ACHIEVEMENT EMBLEMS</span><h3>Faction mastery</h3><p>Win three eligible multiplayer games with a faction to unlock its Commander emblem.</p></header><div className="emblem-progress-grid"><button className={selected==="horizon"?"unlocked selected":"unlocked"} disabled={busy} onClick={()=>void run(async()=>{await selectCommanderEmblem("horizon");setSession(await resumeCommanderAccount())})}><img src="/horizon-logo.png" alt="Horizon Commander"/><span><b>Horizon</b><small>Default emblem</small></span></button>{factions.map(([id,faction])=>{const wins=stats.winsByFaction[id]||0,unlocked=session.account.emblems.unlocked.includes(id);return <button key={id} className={`${unlocked?"unlocked":"locked"} ${selected===id?"selected":""}`} disabled={busy||!unlocked} onClick={()=>void run(async()=>{await selectCommanderEmblem(id);setSession(await resumeCommanderAccount())})}><img src={faction.logo} alt=""/><span><b>{faction.name}</b><small>{unlocked?"Unlocked":`${Math.min(wins,3)} / 3 victories`}</small></span></button>})}</div></section>
    <div className="profile-two-column"><section className="profile-section"><header><span>PROFILE DETAILS</span><h3>Public identity</h3></header><label className="profile-field"><span>Commander name</span><input value={name} onChange={event=>setName(event.target.value)} maxLength={40}/></label><button disabled={busy||!name.trim()} onClick={()=>void run(async()=>{await updateCommanderAccount(name);setSession(await resumeCommanderAccount())})}>Update name</button><div className="account-entitlements"><span>CONTENT ACCESS</span>{session.account.entitlements.map(record=><small key={`${record.expansionId}:${record.provider}`}><b>Shattered Reach</b> · {record.status} via {record.provider} · offline through {new Date(record.offlineUntil).toLocaleDateString()}</small>)}</div></section>
      <section className="profile-section"><header><span>SIGN-IN METHODS</span><h3>Linked identities</h3><p>Add more than one method so losing one provider does not lock you out.</p></header>{emailForm("link")}{providerButtons("link")}<div className="identity-sessions">{session.identities.map(identity=><div key={identity.id}><span><b>{identity.provider[0].toUpperCase()+identity.provider.slice(1)}</b><small>{identity.label}</small></span><button disabled={busy||(session.identities.length===1&&!loadRecoveryKey())} title={session.identities.length===1&&!loadRecoveryKey()?"Create and save a recovery key before unlinking the final identity.":undefined} onClick={()=>void run(async()=>{await unlinkCommanderIdentity(identity.id);setSession(await resumeCommanderAccount())})}>Unlink</button></div>)}</div></section></div>
    <div className="profile-two-column"><section className="profile-section"><header><span>DEVICE SECURITY</span><h3>Active devices</h3></header><div className="identity-sessions">{session.sessions.map(device=><div key={device.id}><span><b>{device.deviceLabel}</b><small>{device.revokedAt?"Revoked":device.current?"Current device":`Last used ${new Date(device.lastUsedAt).toLocaleDateString()}`}</small></span>{!device.current&&!device.revokedAt&&<button onClick={()=>void run(async()=>{await revokeCommanderSession(device.id);setSession(await resumeCommanderAccount())})}>Revoke</button>}</div>)}</div><button disabled={busy} onClick={()=>void run(async()=>{await revokeOtherCommanderSessions();setSession(await resumeCommanderAccount())})}>Sign out other devices</button></section>
      <section className="profile-section"><header><span>RECENT CAMPAIGNS</span><h3>Match history</h3></header><div className="match-history">{session.account.recentMatches.length?session.account.recentMatches.map(match=><article key={match.id}><b>{factionLibrary[match.factionId]?.name||match.factionId}</b><span className={match.won?"win":"loss"}>{match.won?"Victory":"Defeat"}</span><small>{match.legacy} LP · {match.gateSucceeded?"Gate completed":"Gate failed"} · {new Date(match.completedAt).toLocaleDateString()}</small></article>):<p>Eligible completed multiplayer games will appear here.</p>}</div></section></div>
    <section className="profile-section account-security-actions"><header><span>ACCOUNT CONTROLS</span><h3>Recovery and data</h3></header><div className="account-actions">{loadRecoveryKey()?<button disabled={busy} onClick={()=>void navigator.clipboard.writeText(loadRecoveryKey()).then(()=>setMessage("Recovery key copied. Keep it private."))}>Copy recovery key</button>:<button disabled={busy} onClick={()=>void run(async()=>{await rotateCommanderRecoveryKey();setMessage("Recovery key created. Copy it now and store it safely.")})}>Create recovery key</button>}<button disabled={busy} onClick={()=>void run(exportCommanderAccount)}>Export data</button><button disabled={busy} onClick={()=>void run(async()=>{await signOutCommanderAccount();setSession(null)})}>Sign out</button><button className="danger" disabled={busy} onClick={()=>{if(confirm("Delete this Commander account? Solo cloud saves and linked identities will be permanently removed.")) void run(async()=>{await deleteCommanderAccount();setSession(null)})}}>Delete account</button></div>{session.account.roles.some(role=>role==="owner"||role==="admin"||role==="support"||role==="analyst")&&<a href="/admin">Open Horizon Operations</a>}</section>
    {message&&<p className="profile-message" role="status">{message}</p>}
  </section>;
}

function ContentCards({catalog,detailed=false,onOpen}:{catalog:ContentCatalog|null;detailed?:boolean;onOpen?:(id:string)=>void}) {
  const installed = catalog?.packs || [];
  return <div className={`content-library ${detailed?"detailed":""}`}>{plannedPacks.map((pack,index)=><article key={pack.id} className={pack.stage}><div className="content-cover" data-pack={pack.id}><span>{String(index+1).padStart(2,"0")}</span></div><header><span>{pack.status}</span><h2>{pack.name}</h2></header><p>{pack.description}</p>{detailed && <div className="content-factions" aria-label={`${pack.name} factions`}>{pack.factions.map(faction=><span key={faction}>{faction}</span>)}</div>}{onOpen && <button className="content-open" onClick={()=>onOpen(pack.id)}>View expansion</button>}<footer><b>{pack.contents}</b><small>{pack.status}</small></footer></article>)}{installed.map(pack=><article key={pack.id} className="installed"><div className="content-cover"><span>+</span></div><header><span>INSTALLED PACK</span><h2>{pack.name}</h2></header><p>{pack.description || "External Horizon content package."}</p><footer><b>{pack.factions.length} factions · {pack.maps.length} maps</b><small>Version {pack.version}</small></footer></article>)}</div>;
}

function ExpansionArchive({catalog}:{catalog:ContentCatalog|null}) {
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const pack=plannedPacks.find(candidate=>candidate.id===selectedId);
  if(!pack) return <><p className="future-content-note">The Core Set and Shattered Reach are playable in this release. Later expansion concepts remain documented previews with no announced release dates.</p><ContentCards catalog={catalog} detailed onOpen={setSelectedId}/></>;
  const briefs=expansionFactionBriefs[pack.id]||{};
  return <div className="expansion-page"><button className="expansion-back" onClick={()=>setSelectedId(null)}>Back to all expansions</button><header><span>{pack.status}</span><h2>{pack.name}</h2><p>{pack.description}</p><b>{pack.contents}</b></header><section><h3>Factions</h3><div className="expansion-faction-grid">{pack.factions.map(faction=><article key={faction}><h4>{faction}</h4><p>{briefs[faction]||"Faction design preview."}</p></article>)}</div></section><section className="expansion-scope"><h3>Expansion scope</h3><p>{pack.id==="shattered-reach"?"Includes the Shattered Reach map, five playable factions, mobile Habitats, Blockades, Bombardment, Arcologies, Enhanced Centers, and faction Academy scenarios.":pack.id==="beyond-known"?"Planned around the larger Orrery map plus exploration, research, cooperation, and preservation systems.":pack.id==="delegate-dawn"?"Planned with a public Galactic Policy module and an expanded Hidden Objective deck.":"Designed as a focused faction pack whose new systems remain compatible with the Core Set."}</p></section></div>;
}
