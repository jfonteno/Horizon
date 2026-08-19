"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  formatPurchaseCost,
  projectedOrderBudget,
  technologyBranches,
  technologyQuote,
} from "../../game";
import type { GameState, SecretOrder, TechnologyBranch } from "../../game";

const roman = ["0", "I", "II", "III", "IV"];

const benefits: Record<TechnologyBranch, string[]> = {
  Military: [
    "Patrol Vessels and Transports",
    "Frigates and Assault Vessels",
    "Cruisers and Heavy Transports",
    "Battleships and Fleet Transports",
  ],
  Economy: [
    "Range 3 direct trade and basic Market access",
    "Range 5 direct trade and improved Market rates",
    "Unlimited contacted trade and resource selling",
    "Unlimited trade and 1:1 Market exchange",
  ],
  Policy: [
    "Trade and Non-Aggression agreements",
    "Open Borders and Research agreements",
    "Defensive Pacts and Alliances",
    "Reduced Influence cost for agreements",
  ],
  Exploration: [
    "Standard Exploration Vessel",
    "Faction exploration vessels and systems",
    "Advanced exploration capability",
    "Maximum exploration capability",
  ],
  Resource: [
    "Outposts, basic Centers, and Defense Grids",
    "Colony Habitat upgrades",
    "Metropolis Habitat upgrades",
    "Double world and Center production",
  ],
};

export default function TechnologyPanel({
  game,
  draft,
  setDraft,
  flash,
}: {
  game: GameState;
  draft: SecretOrder[];
  setDraft: Dispatch<SetStateAction<SecretOrder[]>>;
  flash: (message: string) => void;
}) {
  const player = game.players[game.active];
  const drafted = draft.find((order) => order.kind === "technology");

  function candidate(branch: TechnologyBranch) {
    const nextOrder: SecretOrder = { id: `technology-${branch.toLowerCase()}`, kind: "technology", branch };
    const nextDraft = [
      ...draft.filter((order) => order.kind !== "technology"),
      nextOrder,
    ];
    const budget = projectedOrderBudget(game, player.id, nextDraft);
    return { nextDraft, error: budget.error };
  }

  function select(branch: TechnologyBranch) {
    const result = candidate(branch);
    if (result.error) {
      flash(result.error);
      return;
    }
    setDraft(result.nextDraft);
    flash(`${branch} advancement added to the private draft.`);
  }

  return <div className="technology-console">
    <div className="technology-heading">
      <span>TECHNOLOGY DEVELOPMENT</span>
      <h3>Choose one advancement</h3>
      <p>Technology resolves after construction and becomes active next Turn. Selecting another branch replaces the current Technology Order.</p>
    </div>
    <div className="technology-grid">
      {technologyBranches.map((branch) => {
        const level = player.tech[branch];
        const quote = technologyQuote(game, player.id, branch);
        const result = level < 4 ? candidate(branch) : { error: quote.reason };
        const selected = drafted?.kind === "technology" && drafted.branch === branch;
        const disabled = !quote.available || !!result.error;
        return <article className={`technology-card ${selected ? "selected" : ""}`} key={branch}>
          <header><span>{branch.toUpperCase()}</span><strong>{roman[level]}</strong></header>
          <div className="tech-track">{[1, 2, 3, 4].map((step) => <i className={step <= level ? "complete" : step === level + 1 ? "next" : ""} key={step}>{roman[step]}</i>)}</div>
          <h4>{level >= 4 ? "Mastered" : `Advance to ${roman[level + 1]}`}</h4>
          <p>{benefits[branch][Math.min(level, 3)]}</p>
          <div className="tech-cost"><span>ADVANCEMENT COST</span><b>{formatPurchaseCost(quote.cost)}</b></div>
          <button disabled={disabled} onClick={() => select(branch)}>{selected ? "Selected in draft" : level >= 4 ? "Maximum level" : disabled ? "Cannot afford" : "Add Technology Order"}</button>
          {disabled && level < 4 && <small>{result.error || quote.reason}</small>}
        </article>;
      })}
    </div>
  </div>;
}
