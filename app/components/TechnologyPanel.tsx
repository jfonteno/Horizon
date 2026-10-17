"use client";

import { useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { factionLibrary, projectedOrderBudget, technologyBranches, technologyQuote } from "../../game";
import type { FactionId, GameState, SecretOrder, TechnologyBranch } from "../../game";
import { technologyCost } from "../../game/rules/diplomacy";
import { technologyCosts } from "../../game/rules/economy";
import { ResourceGlyph, type DisplayResource } from "./network/ResourceGlyph";

const roman = ["0", "I", "II", "III", "IV"];
const levels = [1, 2, 3, 4] as const;
const colors: Record<TechnologyBranch, string> = { Military: "#f08b76", Economy: "#e7bd6a", Policy: "#bd9de7", Exploration: "#67bade", Resource: "#80d5ae" };
const icons: Record<TechnologyBranch, string> = {
  Military: "M12 2 20 6v6c0 5-4 8-8 10-4-2-8-5-8-10V6zM8 12l8 4m0-4-8 4",
  Economy: "M4 7h16M4 12h16M4 17h16M7 4v16m10-16v16",
  Policy: "M12 3 4 7v5c0 5 4 8 8 9 4-1 8-4 8-9V7zM9 12l2 2 4-4",
  Exploration: "M12 2 15 9l7 3-7 3-3 7-3-7-7-3 7-3z",
  Resource: "M4 8 12 3l8 5-8 5-8-5zM4 8l8 5 8-5M12 13v9",
};
const universalBenefits: Record<TechnologyBranch, readonly string[]> = {
  Military: ["Build Patrol Vessels and Transports.", "Build Frigates and Assault Vessels. Military vessels gain +1 movement.", "Build Cruisers and Heavy Transports. Military vessels gain +2 movement.", "Build Battleships and Fleet Transports. Military vessels gain +4 movement."],
  Economy: ["Trade directly within range 3. Exchange 3 Currency for 1 Material or Research at the System Market.", "Trade directly within range 5. Exchange 2 Currency for 1 Material or Research at the System Market.", "Trade with any contacted civilization. Sell Material or Research at the System Market at a 2:1 rate.", "Trade with any contacted civilization. Exchange eligible resources at the System Market at a 1:1 rate."],
  Policy: ["Propose Trade and Non-Aggression agreements.", "Propose Open Borders and Research agreements.", "Propose Defensive Pacts and Alliances.", "Agreements cost 1 less Influence, to a minimum of 0."],
  Exploration: ["Build Exploration Vessels. Each can publicly reveal up to 1 unknown hex per Turn.", "Build Survey Vessels. Exploration vessels gain +1 movement and can publicly reveal up to 2 unknown hexes per Turn.", "Build Deep Survey Vessels. Exploration vessels gain +2 movement and can publicly reveal up to 3 unknown hexes per Turn.", "Build Pathfinder Vessels. Exploration vessels gain +3 movement and can publicly reveal up to 4 unknown hexes per Turn. Sacrifice an Exploration Vessel and a Homeworld Center slot to open a portal to its destination."],
  Resource: ["Establish Outposts, build basic economic Centers and Defense Grids.", "Upgrade Outposts into two-slot Colonies.", "Upgrade Colonies into three-slot Metropolises.", "Double world and Center resource production."],
};
type FactionBenefit = { faction: FactionId; title: string; detail: string };
const factionBenefits: Partial<Record<TechnologyBranch, Partial<Record<1 | 2 | 3 | 4, FactionBenefit[]>>>> = {
  Military: {
    1: [{ faction: "varkesh", title: "Efficient Ship Frames", detail: "Standard military vessels cost 1 less Material, to a minimum of 1." }, { faction: "aegis", title: "Enhanced Home Guard", detail: "Controlled Habitats begin with stronger Home Guard values." }, { faction: "salvo", title: "Bombardment", detail: "Your starting Bombard Frigate can bombard hexes within range 1." }, { faction: "spires", title: "Spires Defense Grid", detail: "Your Defense Grids begin at 3 Home Guard strength." }],
    2: [{ faction: "varkesh", title: "Corvette", detail: "Build a fast, low-capacity rapid-response vessel." }, { faction: "aegis", title: "Blockade Deployment", detail: "Build Blockades and a vessel that carries up to 3 of them." }, { faction: "salvo", title: "Bombard Frigate", detail: "Build Bombard Frigates and bombard at range 2." }, { faction: "spires", title: "Fortified Grids", detail: "Spires Defense Grids rise to 4 Home Guard strength." }, { faction: "wayfarers", title: "Escort Doctrine", detail: "Escorted mobile Habitats survive tied defensive combat." }],
    3: [{ faction: "wayfarers", title: "Gunnery Platform", detail: "Build a caravan escort with 4 CS, or 6 CS while defending a mobile Habitat." }, { faction: "salvo", title: "Siege Cruiser", detail: "Build Siege Cruisers and bombard at range 4." }],
    4: [{ faction: "varkesh", title: "Xebec", detail: "Build a fast vessel with capacity for up to 12 Combat Units." }, { faction: "salvo", title: "Siege Tender", detail: "Build a coordination vessel. Bombardment reaches range 7; one nearby shot per Turn can gain +1 range." }, { faction: "spires", title: "Fortified Grids", detail: "Spires Defense Grids rise to 5 Home Guard strength." }],
  },
  Economy: {
    1: [{ faction: "helix", title: "Research Reallocation", detail: "Choose Research, Material, or Currency for your Homeworld’s next Production." }],
    2: [{ faction: "aegis", title: "Security Export", detail: "Offer another civilization a newly commissioned Blockade for construction cost plus your negotiated fee." }, { faction: "meridian", title: "Commercial Foundation", detail: "Begin at Economy II with 2 Currency and a Currency-producing Homeworld." }],
    3: [{ faction: "guilds", title: "Factory", detail: "Build a Factory that produces a selected Material, Currency, or Research each Production." }, { faction: "meridian", title: "Economic Salvage", detail: "Remove 4 controlled Combat Units to gain 1 Currency. A vessel left without a crew is destroyed." }],
  },
  Policy: {
    1: [{ faction: "meridian", title: "First Agreement Free", detail: "Your first Trade Agreement costs no Influence." }, { faction: "aurelians", title: "Web of Relations", detail: "Gain 1 Influence the first time you establish a formal agreement with each other civilization." }],
    2: [{ faction: "aurelians", title: "Political Capital and Influence Exchange", detail: "Begin at Policy II. Trade Influence directly, exchange 2 Influence for 1 eligible resource, or spend Influence on Labor Capacity." }, { faction: "farbound", title: "Survey Exchange", detail: "Sell eligible private survey information to another civilization for an agreed Currency price." }],
  },
  Exploration: {
    1: [{ faction: "farbound", title: "Forward Scan", detail: "Privately identify one adjacent unrevealed hex per Turn; public discoveries can grant bonus resources." }, { faction: "wayfarers", title: "Mobile Extraction", detail: "A deployed mobile Habitat produces one resource matching the world beneath it." }],
    2: [{ faction: "foundry", title: "Prospector", detail: "Build a vessel that prospects an eligible unclaimed world for 1 Material once per hex." }, { faction: "farbound", title: "Long-Range Surveyor", detail: "Build a vessel that privately surveys any unrevealed hex during Orders." }, { faction: "aurelians", title: "Envoy", detail: "Build an Envoy. Hosting a civilization's Envoys grants exactly 1 Influence per completed direct trade with it." }, { faction: "wayfarers", title: "Deep Recon", detail: "Once per Turn, privately inspect one adjacent unrevealed hex." }],
    4: [{ faction: "farbound", title: "Frontier Legacy", detail: "The first qualifying surveyed Habitat established each Era awards 2 Legacy Points." }],
  },
  Resource: {
    1: [{ faction: "spires", title: "Urban Planning", detail: "Habitat upgrades cost 1 less Currency." }, { faction: "helix", title: "Research Infrastructure", detail: "Research Centers cost only 1 Material, 1 Currency, and 1 Labor." }, { faction: "guilds", title: "Enhanced Centers", detail: "Enhance eligible economic Centers by committing permanent Labor Capacity." }, { faction: "aegis", title: "First Center Discount", detail: "Your first economic Center costs 1 less Currency." }, { faction: "foundry", title: "Prefabricated Habitats", detail: "Habitat Modules cost no Labor." }],
    2: [{ faction: "wayfarers", title: "Arkship", detail: "Build another two-slot mobile Habitat and move it with Migration Orders." }],
    3: [{ faction: "spires", title: "Arcology", detail: "Upgrade a Colony directly to a four-slot Arcology, replacing the usual Metropolis path." }, { faction: "wayfarers", title: "Grand Ark", detail: "Build a three-slot mobile Habitat." }, { faction: "guilds", title: "Enhanced Centers", detail: "A Habitat may support up to 2 Enhanced Centers at this level." }],
    4: [{ faction: "wayfarers", title: "Worldship", detail: "Build one four-slot mobile Worldship." }, { faction: "guilds", title: "Enhanced Centers", detail: "A Habitat may support up to 3 Enhanced Centers at this level." }],
  },
};
const branchResource: Record<TechnologyBranch, DisplayResource> = { Military: "material", Economy: "currency", Policy: "influence", Exploration: "currency", Resource: "material" };
type Props = { game?: GameState; draft?: SecretOrder[]; setDraft?: Dispatch<SetStateAction<SecretOrder[]>>; flash?: (message: string) => void; mode?: "browse" | "orders" };

export default function TechnologyPanel({ game, draft = [], setDraft, flash, mode = "orders" }: Props) {
  const player = game?.players[game.active];
  const browse = mode === "browse" || !player;
  const [expandedBranch, setExpandedBranch] = useState<TechnologyBranch | null>(null);
  const [expandedLevel, setExpandedLevel] = useState<{ branch: TechnologyBranch; level: number } | null>(null);

  function details(branch: TechnologyBranch, level: 1 | 2 | 3 | 4) {
    const owned = player?.tech[branch] || 1;
    const base = technologyCosts[level];
    const cost: Record<string, number> = level === 1 ? {} : player && game ? technologyCost(game, player.id, branch, level) : { research: base[0], labor: base[1], [branchResource[branch]]: base[2] };
    const next = level === owned + 1;
    const quote = player && game && next ? technologyQuote(game, player.id, branch) : null;
    const order: SecretOrder = { id: `technology-${branch.toLowerCase()}`, kind: "technology", branch };
    const nextDraft = [...draft.filter((entry) => entry.kind !== "technology"), order];
    const budget = player && game && next ? projectedOrderBudget(game, player.id, nextDraft) : null;
    const selectedInDraft = draft.some((entry) => entry.kind === "technology" && entry.branch === branch);
    const canOrder = !browse && next && quote?.available && !budget?.error && !!setDraft;
    const unique = factionBenefits[branch]?.[level] || [];

    return <div id={`technology-details-${branch}-${level}`} className="technology-inspector" style={{ "--branch-color": colors[branch] } as CSSProperties}>
      <div className="technology-inspector-title"><div><span>{branch.toUpperCase()} · LEVEL {roman[level]}</span><h3>{branch} {roman[level]}</h3></div></div>
      <section className="technology-universal"><h4>For every civilization</h4><p>{universalBenefits[branch][level - 1]}</p></section>
      <div className="technology-prerequisites"><h4>Prerequisites</h4><span className={player && level > owned + 1 ? "missing" : ""}>{level === 1 ? "Available at the start" : `${branch} ${roman[level - 1]} required`}</span>{player && level > owned + 1 && <small>Advance through the earlier levels first.</small>}</div>
      {level > 1 && <div className="technology-resource-cost"><h4>{browse ? "Base cost" : "Research cost"}</h4><div>{Object.entries(cost).filter(([, amount]) => amount > 0).map(([key, amount]) => { const missing = player && level > owned && (key === "labor" ? player.labor : player.resources[key as keyof typeof player.resources]) < amount; return <span className={missing ? "missing" : ""} key={key}><ResourceGlyph resource={key as DisplayResource} label={false}/><b>{amount}</b><small>{key}</small></span>; })}</div>{browse && <small>Exact costs may vary by faction, Policy, and agreements.</small>}</div>}
      {!browse && player && level <= owned && <p className="technology-state">Researched and active.</p>}
      {!browse && player && next && <><button type="button" className="technology-order-button" disabled={!canOrder} onClick={() => { setDraft?.(nextDraft); flash?.(`${branch} advancement added to the private draft.`); }}>{selectedInDraft ? "Selected in draft" : "Add Technology Order"}</button>{(budget?.error || quote?.reason) && !canOrder && <small className="technology-reason">{budget?.error || quote?.reason}</small>}</>}
      {!browse && player && level > owned + 1 && <p className="technology-state">Future level. Research the preceding levels first.</p>}
      <section className="technology-faction-benefits"><h4>Faction benefits at this level</h4>{unique.length ? <div className="technology-faction-list">{unique.map((benefit) => { const faction = factionLibrary[benefit.faction]; return <article key={`${benefit.faction}-${benefit.title}`} style={{ "--faction-color": faction.color } as CSSProperties}><img src={faction.logo} alt="" loading="lazy"/><div><strong>{faction.name} · {benefit.title}</strong><p>{benefit.detail}</p></div></article>; })}</div> : <p>No additional faction-specific unlocks at this level.</p>}</section>
    </div>;
  }

  return <div className={`technology-browser ${browse ? "browse" : "in-game"}`}>
    <header className="technology-browser-heading"><span>TECHNOLOGY ARCHIVE</span><h2>{browse ? "Explore every path" : "Plan your next advancement"}</h2><p>Open a branch, then choose a level to see shared rules, faction benefits, cost, and prerequisites. {browse ? "Faction and agreement discounts appear in a match." : "Only your next level can be drafted. Technology resolves after construction and becomes active next Turn."}</p></header>
    <div className="technology-branches" aria-label="Technology branches">
      {technologyBranches.map((branch) => <section className="technology-branch" key={branch} style={{ "--branch-color": colors[branch] } as CSSProperties}>
        <button type="button" className="technology-branch-toggle" aria-expanded={expandedBranch === branch} aria-controls={`technology-levels-${branch}`} onClick={() => { setExpandedBranch((current) => current === branch ? null : branch); setExpandedLevel(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d={icons[branch]} /></svg><span><b>{branch}</b><small>{player ? `Current level ${roman[player.tech[branch]]}` : "Levels I–IV"}</small></span><span className="technology-chevron" aria-hidden="true">⌄</span></button>
        {expandedBranch === branch && <div id={`technology-levels-${branch}`} className="technology-levels">{levels.map((level) => <div className="technology-level" key={level}><button type="button" className={`technology-level-toggle ${expandedLevel?.branch === branch && expandedLevel.level === level ? "selected" : ""} ${player && level <= player.tech[branch] ? "owned" : ""}`} aria-expanded={expandedLevel?.branch === branch && expandedLevel.level === level} aria-controls={`technology-details-${branch}-${level}`} onClick={() => setExpandedLevel((current) => current?.branch === branch && current.level === level ? null : { branch, level })}><span className="technology-level-number">{roman[level]}</span><span className="technology-level-name">{branch} {roman[level]}<small>{player && level <= player.tech[branch] ? "Researched" : level === 1 ? "Starting level" : "View benefits and cost"}</small></span><span className="technology-chevron" aria-hidden="true">⌄</span></button>{expandedLevel?.branch === branch && expandedLevel.level === level && details(branch, level)}</div>)}</div>}
      </section>)}
    </div>
  </div>;
}
