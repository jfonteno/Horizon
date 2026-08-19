"use client";

import { useState } from "react";
import {
  activeAgreements,
  addAgreementProposal,
  addTechnologyProposal,
  addTradeProposal,
  agreementCost,
  agreementNames,
  agreementRules,
  breakAgreement,
  cancelProposal,
  emptyTradeBundle,
  habitatDistance,
  isContacted,
  politicalCapital,
  scheduleWithdrawal,
  technologyCost,
  tradeEligibility,
} from "../../game";
import type {
  AgreementProposal,
  AgreementType,
  GameState,
  TechnologyBranch,
  TechnologyProposal,
  TradeBundle,
  TradeProposal,
  TradableResource,
} from "../../game";

type Props = {
  game: GameState;
  commit: (game: GameState) => void;
  flash: (message: string) => void;
  review: (proposalId: string) => void;
};

const tradeResources = ["material", "currency", "research", "labor"] as const;
const agreementTypes: AgreementType[] = ["trade", "nonAggression", "openBorders", "research", "defensive", "alliance"];
const branches: TechnologyBranch[] = ["Military", "Economy", "Policy", "Exploration", "Resource"];

function proposalId() {
  return globalThis.crypto?.randomUUID?.() || `proposal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneBundle(bundle: TradeBundle): TradeBundle {
  return { material: bundle.material, currency: bundle.currency, research: bundle.research, labor: bundle.labor };
}

function describeBundle(bundle: TradeBundle) {
  const items = tradeResources.filter(resource => bundle[resource] > 0).map(resource => `${bundle[resource]} ${resource}`);
  return items.length ? items.join(", ") : "nothing";
}

export default function DiplomacyPanel({ game, commit, flash, review }: Props) {
  const player = game.players[game.active];
  const rivals = game.players.filter(candidate => candidate.id !== player.id);
  const [targetId, setTargetId] = useState(rivals[0]?.id ?? 0);
  const [offer, setOffer] = useState<TradeBundle>(emptyTradeBundle);
  const [request, setRequest] = useState<TradeBundle>(emptyTradeBundle);
  const [agreementType, setAgreementType] = useState<AgreementType>("trade");
  const [branch, setBranch] = useState<TechnologyBranch>("Economy");
  const [compensation, setCompensation] = useState<Record<TradableResource, number>>({ material: 0, currency: 0, research: 0 });
  const target = game.players[targetId] || rivals[0];
  const eligibility = target ? tradeEligibility(game, player.id, target.id) : { ok: false, message: "No other civilization is available.", distance: null };
  const distance = target ? habitatDistance(game, player.id, target.id) : null;
  const agreements = target ? activeAgreements(game, player.id, target.id) : [];
  const incoming = game.proposals.filter(proposal => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.buyer === player.id : proposal.to === player.id));
  const outgoing = game.proposals.filter(proposal => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.seller === player.id : proposal.from === player.id));
  const sellable = branches.filter(item => target && player.tech[item] > target.tech[item]);
  const activeBranch = sellable.includes(branch) ? branch : sellable[0];

  function run(action: (draft: GameState) => { ok: boolean; message: string }, proposal?: { id: string; recipient: number }) {
    const draft = structuredClone(game);
    const result = action(draft);
    flash(result.message);
    if (!result.ok) return;
    commit(draft);
    if (proposal) review(proposal.id);
  }

  function setBundle(side: "offer" | "request", resource: typeof tradeResources[number], value: string) {
    const amount = Math.max(0, Math.min(99, Number(value) || 0));
    const setter = side === "offer" ? setOffer : setRequest;
    const current = side === "offer" ? offer : request;
    setter({ ...current, [resource]: amount });
  }

  function proposeTrade() {
    if (!target) return;
    const proposal: TradeProposal = { id: proposalId(), kind: "trade", from: player.id, to: target.id, offer: cloneBundle(offer), request: cloneBundle(request), createdTurn: game.turn, status: "pending" };
    run(draft => addTradeProposal(draft, proposal), { id: proposal.id, recipient: target.id });
  }

  function proposeAgreement() {
    if (!target) return;
    const proposal: AgreementProposal = { id: proposalId(), kind: "agreement", from: player.id, to: target.id, agreementType, createdTurn: game.turn, status: "pending" };
    run(draft => addAgreementProposal(draft, proposal), { id: proposal.id, recipient: target.id });
  }

  function proposeTechnology() {
    if (!target) return;
    if (!activeBranch) return;
    const level = target.tech[activeBranch] + 1;
    const proposal: TechnologyProposal = { id: proposalId(), kind: "technology", seller: player.id, buyer: target.id, branch: activeBranch, level, compensation: { ...compensation }, createdTurn: game.turn, status: "pending" };
    run(draft => addTechnologyProposal(draft, proposal), { id: proposal.id, recipient: target.id });
  }

  function mutateAgreement(id: string, immediate: boolean) {
    run(draft => immediate ? breakAgreement(draft, id, player.id) : scheduleWithdrawal(draft, id, player.id));
  }

  function cancel(id: string) {
    const draft = structuredClone(game);
    if (cancelProposal(draft, id, player.id)) {
      commit(draft);
      flash("Proposal cancelled.");
    }
  }

  function convert(output: "currency" | "material" | "labor") {
    run(draft => politicalCapital(draft, player.id, output));
  }

  if (!target) return <section className="diplomacy-console"><h1>Diplomacy Console</h1><p>At least two civilizations are required.</p></section>;

  return <section className="diplomacy-console">
    <header className="diplomacy-header">
      <div><p>DIPLOMATIC NETWORK // TURN {game.turn}</p><h1>Direct Trade and Agreements</h1></div>
      <div className="pending-count"><strong>{incoming.length}</strong><span>Incoming</span></div>
    </header>

    <div className="rival-tabs">{rivals.map(rival => <button key={rival.id} className={target.id === rival.id ? "active" : ""} onClick={() => setTargetId(rival.id)} style={{ "--rival": rival.color } as React.CSSProperties}><i/><span>{rival.name}</span><small>{isContacted(game, player.id, rival.id) ? "Contact" : "Uncontacted"}</small></button>)}</div>

    <div className="diplomacy-scroll">
      <div className="relation-card">
        <div><span>RELATION</span><strong>{player.name} ↔ {target.name}</strong></div>
        <div><span>NEAREST HABITATS</span><strong>{distance === null ? "No route" : `${distance} hexes`}</strong></div>
        <div><span>DIRECT TRADE</span><strong className={eligibility.ok ? "status-good" : "status-bad"}>{eligibility.ok ? "In range" : "Unavailable"}</strong></div>
        <p>{eligibility.message}</p>
      </div>

      <div className="diplomacy-grid">
        <article className="diplomacy-card trade-card">
          <div className="card-title"><div><span>NEGOTIATED EXCHANGE</span><h2>Direct Trade</h2></div><small>Influence is not tradable</small></div>
          <div className="trade-table"><div className="trade-head"><span>Resource</span><span>You give</span><span>You request</span></div>{tradeResources.map(resource => <label className="trade-row" key={resource}><b>{resource}</b><input aria-label={`Offer ${resource}`} type="number" min="0" max="99" value={offer[resource]} onChange={event => setBundle("offer", resource, event.target.value)}/><input aria-label={`Request ${resource}`} type="number" min="0" max="99" value={request[resource]} onChange={event => setBundle("request", resource, event.target.value)}/></label>)}</div>
          <p className="rule-note">Labor permanently transfers Capacity at the start of the next Turn and requires a Trade Agreement or Alliance.</p>
          <button className="primary wide" disabled={!eligibility.ok} onClick={proposeTrade}>Send private proposal</button>
        </article>

        <article className="diplomacy-card agreement-card">
          <div className="card-title"><div><span>FORMAL RELATIONS</span><h2>Agreement</h2></div><small>Both parties pay Influence</small></div>
          <select value={agreementType} onChange={event => setAgreementType(event.target.value as AgreementType)}>{agreementTypes.map(type => <option key={type} value={type}>{agreementNames[type]}</option>)}</select>
          <div className="agreement-rule"><strong>{agreementNames[agreementType]}</strong><p>{agreementRules[agreementType].effect}</p><span>Policy {agreementRules[agreementType].policy} required</span><span>You pay {agreementCost(game, player.id, agreementType)} Influence</span><span>They pay {agreementCost(game, target.id, agreementType)} Influence</span></div>
          <button className="primary wide" onClick={proposeAgreement}>Propose agreement</button>
          <div className="active-agreements"><h3>Active with {target.name}</h3>{agreements.length ? agreements.map(agreement => <div key={agreement.id}><span><b>{agreementNames[agreement.type]}</b><small>{agreement.endsAfterTurn === game.turn ? "Withdrawal pending" : `Since Turn ${agreement.startedTurn}`}</small></span><button disabled={agreement.endsAfterTurn === game.turn} onClick={() => mutateAgreement(agreement.id, false)}>Withdraw</button><button onClick={() => mutateAgreement(agreement.id, true)}>Break now</button></div>) : <p>No formal agreements.</p>}</div>
        </article>
      </div>

      {player.faction === "helix" && <article className="diplomacy-card faction-action">
        <div className="card-title"><div><span>HELIX EXCLUSIVE</span><h2>Technology Exchange</h2></div><small>Buyer uses its one advance this Turn</small></div>
        {sellable.length && activeBranch ? <><div className="technology-offer"><label>Branch<select value={activeBranch} onChange={event => setBranch(event.target.value as TechnologyBranch)}>{sellable.map(item => <option key={item}>{item}</option>)}</select></label><div><span>Offered level</span><strong>{target.tech[activeBranch] + 1}</strong></div><div><span>Buyer cost</span><strong>{Object.entries(technologyCost(game, target.id, activeBranch, target.tech[activeBranch] + 1, true)).map(([key, value]) => `${value} ${key}`).join(" · ")}</strong></div></div><div className="compensation"><span>Additional payment to Helix</span>{(["material", "currency", "research"] as TradableResource[]).map(resource => <label key={resource}>{resource}<input type="number" min="0" value={compensation[resource]} onChange={event => setCompensation({ ...compensation, [resource]: Math.max(0, Number(event.target.value) || 0) })}/></label>)}</div><button className="primary" onClick={proposeTechnology}>Offer Technology</button></> : <p className="rule-note">The Helix must own a Technology above this civilization.</p>}
      </article>}

      {player.faction === "aurelians" && <article className="diplomacy-card faction-action"><div className="card-title"><div><span>AURELIAN EXCLUSIVE</span><h2>Political Capital</h2></div><small>Requires Policy II</small></div><div className="capital-actions"><button onClick={() => convert("currency")}>2 Influence → 1 Currency</button><button onClick={() => convert("material")}>2 Influence → 1 Material</button><button onClick={() => convert("labor")}>4 Influence → +1 permanent Labor</button></div></article>}

      <article className="diplomacy-card proposal-queue">
        <div className="card-title"><div><span>DEVICE HANDOFF</span><h2>Proposal Queue</h2></div><small>Recipient reviews privately</small></div>
        <div className="queue-columns"><div><h3>Incoming</h3>{incoming.length ? incoming.map(proposal => <button key={proposal.id} onClick={() => review(proposal.id)}><span>{proposal.kind === "trade" ? `Trade: ${describeBundle(proposal.offer)} for ${describeBundle(proposal.request)}` : proposal.kind === "agreement" ? agreementNames[proposal.agreementType] : `${proposal.branch} ${proposal.level}`}</span><b>Review</b></button>) : <p>None pending.</p>}</div><div><h3>Outgoing</h3>{outgoing.length ? outgoing.map(proposal => <div key={proposal.id}><span>{proposal.kind === "trade" ? `Trade with ${game.players[proposal.to].name}` : proposal.kind === "agreement" ? agreementNames[proposal.agreementType] : `${proposal.branch} ${proposal.level}`}</span><button onClick={() => cancel(proposal.id)}>Cancel</button></div>) : <p>None pending.</p>}</div></div>
      </article>
    </div>
  </section>;
}
