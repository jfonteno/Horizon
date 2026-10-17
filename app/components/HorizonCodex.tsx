"use client";

import { useMemo, useState } from "react";
import { civilizationLegacy, codexEntries, factionIds, factionLibrary, searchCodex, type FactionId } from "../../game";
import { factionGuides } from "../../game/factions/guides";

export default function HorizonCodex({ initialEntryId, compact = false }: { initialEntryId?: string; compact?: boolean }) {
  const [mode, setMode] = useState<"rules" | "factions">(initialEntryId ? "rules" : "rules");
  const [query, setQuery] = useState("");
  const [entryId, setEntryId] = useState(initialEntryId || codexEntries[0].id);
  const [factionId, setFactionId] = useState<FactionId>(factionIds[0]);
  const results = useMemo(() => searchCodex(query), [query]);
  const entry = codexEntries.find((candidate) => candidate.id === entryId) || results[0] || codexEntries[0];
  const faction = factionLibrary[factionId];
  const guide = factionGuides[factionId];
  const starting = faction.starting?.resources || {};
  const startingResources = {
    material: starting.material ?? (factionId === "helix" ? 1 : factionId === "foundry" ? 2 : 0),
    currency: starting.currency ?? (factionId === "meridian" ? 2 : factionId === "farbound" ? 1 : 0),
    research: starting.research ?? (factionId === "helix" ? 2 : factionId === "farbound" ? 1 : 0),
  };

  return <div className={`horizon-codex ${compact ? "compact" : ""}`}>
    <header className="codex-tabs">
      <button className={mode === "rules" ? "active" : ""} onClick={() => setMode("rules")}>Rules &amp; Glossary</button>
      <button className={mode === "factions" ? "active" : ""} onClick={() => setMode("factions")}>Civilizations</button>
      {mode === "rules" && <input aria-label="Search Horizon Codex" placeholder="Search rules and terms" value={query} onChange={(event) => setQuery(event.target.value)} />}
    </header>
    {mode === "rules" ? <div className="codex-rules-layout">
      <nav aria-label="Rules Codex entries">
        {results.map((candidate) => <button key={candidate.id} className={candidate.id === entry.id ? "active" : ""} onClick={() => setEntryId(candidate.id)}><span>{candidate.category}</span><b>{candidate.title}</b><small>{candidate.summary}</small></button>)}
        {!results.length && <p>No Codex entries match that search.</p>}
      </nav>
      <article className="codex-rule-entry">
        <span>{entry.category.toUpperCase()}</span><h2>{entry.title}</h2><strong>{entry.summary}</strong>
        {entry.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {entry.terms?.length && <footer>{entry.terms.map((term) => <i key={term}>{term}</i>)}</footer>}
      </article>
    </div> : <div className="codex-layout">
      <nav>{factionIds.map((id) => <button key={id} className={factionId === id ? "active" : ""} style={{ "--codex-color": factionLibrary[id].color } as React.CSSProperties} onClick={() => setFactionId(id)}><img src={factionLibrary[id].logo} alt=""/><span><b>{factionLibrary[id].name}</b><small>{factionLibrary[id].role}</small></span></button>)}</nav>
      <article className="codex-profile" style={{ "--codex-color": faction.color } as React.CSSProperties}>
        <header><img src={faction.logo} alt={`${faction.name} emblem`}/><div><span>{faction.role.toUpperCase()} CIVILIZATION</span><h1>{faction.name}</h1><p>{faction.blurb}</p></div></header>
        <section><h2>Civilization</h2>{(faction.lore?.length ? faction.lore : [faction.blurb]).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</section>
        <section><h2>Starting position</h2><div className="codex-starting">
          <div><span>Resources</span><b>{startingResources.material} Material · {startingResources.currency} Currency · {startingResources.research} Research · {faction.starting?.resources?.influence ?? 1} Influence</b></div>
          <div><span>Homeworld</span><b>Colony producing {faction.homeProduction}{faction.starting?.homeCenter ? ` with a ${faction.starting.homeCenter} Center` : factionId === "foundry" ? " with a Material Center" : ""}</b></div>
          <div><span>Opening fleet</span><b>Exploration Vessel · {factionId === "wayfarers" ? "Arkship instead of Colony Ship" : "Colony Ship"} · {factionId === "salvo" ? "Bombard Frigate" : "Patrol"} with 2 CU</b></div>
          <div><span>Settlement supply</span><b>1 Habitat Module{factionId === "wayfarers" ? " (mobile development is your primary expansion)" : ""}</b></div>
        </div></section>
        <section><h2>Faction abilities and unlocks</h2><div className="codex-abilities">{faction.abilities?.map(ability=><article key={ability.name}><span>{ability.unlock || "INHERENT"}</span><b>{ability.name}</b><p>{ability.summary}</p></article>)}</div></section>
        {guide && <section className="codex-doctrine"><h2>How to play</h2><p>{guide.style}</p><h3>Opening priorities</h3><ol>{guide.opening.map((step)=><li key={step}>{step}</li>)}</ol><h3>Middle game</h3><p>{guide.midgame}</p><h3>Late game</h3><p>{guide.lateGame}</p><h3>Watch for</h3><p>{guide.watchFor}</p></section>}
        <section><h2>Civilization Legacy objectives</h2><div className="codex-objectives">{(civilizationLegacy[factionId] || []).map((objective)=><article key={objective.id}><b>{objective.lp} LP · {objective.name}</b><p>{objective.condition}</p><small>{objective.automatic ? "Tracked automatically" : "Requires confirmation"}</small></article>)}</div></section>
        <footer><div><span>Strategic role</span><b>{faction.role} · {guide?.difficulty || "Varied"}</b></div><div><span>Homeworld production</span><b>{faction.homeProduction}{factionId === "helix" ? " (reallocatable)" : ""}</b></div></footer>
      </article>
    </div>}
  </div>;
}
