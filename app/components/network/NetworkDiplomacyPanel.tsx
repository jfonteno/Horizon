"use client";

import { useState } from "react";
import {
  activeAgreements,
  agreementCost,
  agreementNames,
  agreementRules,
  emptyTradeBundle,
  habitatDistance,
  isContacted,
  technologyBranches,
  technologyCost,
  tradeEligibility,
} from "../../../game";
import type {
  AgreementType,
  GameState,
  RoomCommand,
  TechnologyBranch,
  TradableResource,
  TradeBundle,
} from "../../../game";

const tradeResources = ["material", "currency", "research", "labor"] as const;
const agreementTypes: AgreementType[] = ["trade", "nonAggression", "openBorders", "research", "defensive", "alliance"];

function describeBundle(bundle: TradeBundle) {
  return tradeResources.filter((resource) => bundle[resource] > 0)
    .map((resource) => `${bundle[resource]} ${resource}`).join(", ") || "nothing";
}

function proposalSummary(game: GameState, proposal: GameState["proposals"][number]) {
  if (proposal.kind === "trade") return `${describeBundle(proposal.offer)} for ${describeBundle(proposal.request)}`;
  if (proposal.kind === "agreement") return agreementNames[proposal.agreementType];
  return `${proposal.branch} ${proposal.level}`;
}

export default function NetworkDiplomacyPanel({
  game,
  playerId,
  busy,
  onCommand,
}: {
  game: GameState;
  playerId: number;
  busy: boolean;
  onCommand: (command: RoomCommand) => Promise<void>;
}) {
  const player = game.players[playerId];
  const rivals = game.players.filter((candidate) => candidate.id !== playerId);
  const [targetId, setTargetId] = useState(rivals[0]?.id ?? 0);
  const [offer, setOffer] = useState<TradeBundle>(emptyTradeBundle);
  const [request, setRequest] = useState<TradeBundle>(emptyTradeBundle);
  const [agreementType, setAgreementType] = useState<AgreementType>("trade");
  const [branch, setBranch] = useState<TechnologyBranch>("Economy");
  const [compensation, setCompensation] = useState<Record<TradableResource, number>>({ material: 0, currency: 0, research: 0 });
  const [brokerA, setBrokerA] = useState(rivals[0]?.id ?? 0);
  const [brokerB, setBrokerB] = useState(rivals[1]?.id ?? rivals[0]?.id ?? 0);
  const [brokerAResource, setBrokerAResource] = useState<TradableResource>("material");
  const [brokerBResource, setBrokerBResource] = useState<TradableResource>("currency");
  const [surveyHex, setSurveyHex] = useState(player.privateSurveys[0]?.hexId || "");
  const [surveyTarget, setSurveyTarget] = useState("");
  const [surveyPrice, setSurveyPrice] = useState(1);
  const target = game.players[targetId] || rivals[0];
  const eligibility = target ? tradeEligibility(game, playerId, target.id) : undefined;
  const agreements = target ? activeAgreements(game, playerId, target.id) : [];
  const incoming = game.proposals.filter((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.buyer === playerId : proposal.to === playerId));
  const outgoing = game.proposals.filter((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.seller === playerId : proposal.from === playerId));
  const sellable = technologyBranches.filter((item) => target && player.tech[item] > target.tech[item]);
  const activeBranch = sellable.includes(branch) ? branch : sellable[0];
  const surveyTargets = game.hexes.filter((hex) => !hex.revealed && hex.kind !== "rift" && !player.privateSurveys.some((survey) => survey.hexId === hex.id));
  const activeSurveyTarget = surveyTargets.some((hex) => hex.id === surveyTarget) ? surveyTarget : surveyTargets[0]?.id || "";
  const tradableSurveys = player.privateSurveys.filter((survey) => (survey.tradableTurn === undefined || survey.tradableTurn === game.turn) && !game.hexes.find((hex) => hex.id === survey.hexId)?.revealed);
  const activeSurveyHex = tradableSurveys.some((survey) => survey.hexId === surveyHex) ? surveyHex : tradableSurveys[0]?.hexId || "";

  function setBundle(side: "offer" | "request", resource: typeof tradeResources[number], raw: string) {
    const amount = Math.max(0, Math.min(99, Number(raw) || 0));
    if (side === "offer") setOffer((current) => ({ ...current, [resource]: amount }));
    else setRequest((current) => ({ ...current, [resource]: amount }));
  }

  if (!target) return <div className="network-empty">At least two civilizations are required.</div>;
  const distance = habitatDistance(game, playerId, target.id);

  return <div className="network-diplomacy">
    <header className="network-panel-header"><span>DIPLOMATIC NETWORK</span><h3>Trade, Treaties, and Proposals</h3><p>Diplomacy remains open throughout the Turn. Every accepted transaction is validated against the authoritative room state.</p></header>
    <div className="network-rivals">{rivals.map((rival) => <button key={rival.id} className={rival.id === target.id ? "active" : ""} onClick={() => setTargetId(rival.id)} style={{ "--rival": rival.color } as React.CSSProperties}><i /><b>{rival.name}</b><small>{isContacted(game, playerId, rival.id) ? "Contact" : "Uncontacted"}</small></button>)}</div>
    <div className="network-relation"><span>Nearest Habitats <b>{distance === null ? "No route" : `${distance} hexes`}</b></span><span>Direct Trade <b className={eligibility?.ok ? "status-good" : "status-bad"}>{eligibility?.ok ? "Available" : "Unavailable"}</b></span><p>{eligibility?.message}</p></div>

    <section className="network-diplomacy-card"><h4>Direct Trade</h4><div className="network-trade-grid"><b>Resource</b><b>You give</b><b>You request</b>{tradeResources.map((resource) => <label key={resource}><span>{resource}</span><input aria-label={`Offer ${resource}`} type="number" min="0" value={offer[resource]} onChange={(event) => setBundle("offer", resource, event.target.value)} /><input aria-label={`Request ${resource}`} type="number" min="0" value={request[resource]} onChange={(event) => setBundle("request", resource, event.target.value)} /></label>)}</div><button className="primary wide" disabled={busy || !eligibility?.ok} onClick={() => void onCommand({ kind: "proposeTrade", to: target.id, offer, request })}>Send trade proposal</button></section>

    <section className="network-diplomacy-card"><h4>Formal Agreement</h4><select value={agreementType} onChange={(event) => setAgreementType(event.target.value as AgreementType)}>{agreementTypes.map((type) => <option key={type} value={type}>{agreementNames[type]}</option>)}</select><div className="agreement-rule"><b>{agreementRules[agreementType].effect}</b><small>Policy {agreementRules[agreementType].policy} required. You pay {agreementCost(game, playerId, agreementType)} Influence. They pay {agreementCost(game, target.id, agreementType)} Influence.</small></div><button className="primary wide" disabled={busy} onClick={() => void onCommand({ kind: "proposeAgreement", to: target.id, agreementType })}>Propose {agreementNames[agreementType]}</button><div className="network-agreements">{agreements.map((agreement) => <div key={agreement.id}><span><b>{agreementNames[agreement.type]}</b><small>{agreement.endsAfterTurn === game.turn ? "Withdrawal pending" : `Active since Turn ${agreement.startedTurn}`}</small></span><button disabled={busy || agreement.endsAfterTurn === game.turn} onClick={() => void onCommand({ kind: "withdrawAgreement", agreementId: agreement.id })}>Withdraw</button><button disabled={busy} onClick={() => void onCommand({ kind: "breakAgreement", agreementId: agreement.id })}>Break now</button></div>)}{!agreements.length && <small>No active agreements with this civilization.</small>}</div></section>

    {player.faction === "helix" && <section className="network-diplomacy-card"><h4>Helix Technology Exchange</h4>{activeBranch ? <><select value={activeBranch} onChange={(event) => setBranch(event.target.value as TechnologyBranch)}>{sellable.map((item) => <option key={item}>{item}</option>)}</select><p>Offer {activeBranch} {target.tech[activeBranch] + 1}. Buyer cost: {Object.entries(technologyCost(game, target.id, activeBranch, target.tech[activeBranch] + 1, true)).map(([resource, amount]) => `${amount} ${resource}`).join(" · ")}.</p><div className="network-compensation">{(["material", "currency", "research"] as TradableResource[]).map((resource) => <label key={resource}>{resource}<input type="number" min="0" value={compensation[resource]} onChange={(event) => setCompensation((current) => ({ ...current, [resource]: Math.max(0, Number(event.target.value) || 0) }))} /></label>)}</div><button className="primary wide" disabled={busy} onClick={() => void onCommand({ kind: "proposeTechnology", buyer: target.id, branch: activeBranch, level: target.tech[activeBranch] + 1, compensation })}>Offer Technology</button></> : <p>You do not currently possess a Technology level above this civilization.</p>}</section>}

    {player.faction === "aurelians" && <section className="network-diplomacy-card"><h4>Political Capital</h4><div className="network-button-grid">{(["currency", "material", "labor"] as const).map((output) => <button disabled={busy} key={output} onClick={() => void onCommand({ kind: "politicalCapital", output })}>Influence to {output}</button>)}</div></section>}

    {player.faction === "farbound" && <section className="network-diplomacy-card"><h4>Farbound Negotiation Survey</h4><p>Gather one private survey before sealing Orders. The resulting intelligence may be traded this Turn.</p><select value={activeSurveyTarget} disabled={!surveyTargets.length || player.negotiationSurveyUsedTurn === game.turn} onChange={(event) => setSurveyTarget(event.target.value)}>{surveyTargets.map((hex) => <option key={hex.id} value={hex.id}>{hex.id}</option>)}</select><button className="primary wide" disabled={busy || !activeSurveyTarget || player.negotiationSurveyUsedTurn === game.turn} onClick={() => void onCommand({ kind: "negotiationSurvey", hexId: activeSurveyTarget })}>{player.negotiationSurveyUsedTurn === game.turn ? "Survey gathered this Turn" : "Gather private survey"}</button><h4>Survey Exchange</h4>{tradableSurveys.length ? <><select value={activeSurveyHex} onChange={(event) => setSurveyHex(event.target.value)}>{tradableSurveys.map((survey) => <option key={survey.hexId} value={survey.hexId}>{survey.hexId}</option>)}</select><label className="network-inline-field">Price in Currency<input type="number" min="0" value={surveyPrice} onChange={(event) => setSurveyPrice(Math.max(0, Number(event.target.value) || 0))} /></label><button className="primary wide" disabled={busy || !activeSurveyHex} onClick={() => void onCommand({ kind: "surveyExchange", buyerId: target.id, hexId: activeSurveyHex, price: surveyPrice })}>Sell survey to {target.name}</button></> : <p>No survey gathered for trade this Turn.</p>}</section>}

    {player.faction === "meridian" && <section className="network-diplomacy-card"><h4>Meridian Brokerage</h4><div className="network-broker-grid"><label>First party<select value={brokerA} onChange={(event) => setBrokerA(Number(event.target.value))}>{rivals.map((rival) => <option key={rival.id} value={rival.id}>{rival.name}</option>)}</select></label><label>Gives<select value={brokerAResource} onChange={(event) => setBrokerAResource(event.target.value as TradableResource)}>{(["material", "currency", "research"] as TradableResource[]).map((resource) => <option key={resource}>{resource}</option>)}</select></label><label>Second party<select value={brokerB} onChange={(event) => setBrokerB(Number(event.target.value))}>{rivals.map((rival) => <option key={rival.id} value={rival.id}>{rival.name}</option>)}</select></label><label>Gives<select value={brokerBResource} onChange={(event) => setBrokerBResource(event.target.value as TradableResource)}>{(["material", "currency", "research"] as TradableResource[]).map((resource) => <option key={resource}>{resource}</option>)}</select></label></div><button className="primary wide" disabled={busy || brokerA === brokerB} onClick={() => { const aGives = emptyTradeBundle(); const bGives = emptyTradeBundle(); aGives[brokerAResource] = 1; bGives[brokerBResource] = 1; void onCommand({ kind: "brokerTrade", a: brokerA, b: brokerB, aGives, bGives }); }}>Broker one-for-one exchange</button></section>}

    <section className="network-diplomacy-card proposal-queue"><h4>Incoming Proposals</h4>{incoming.map((proposal) => <div className="network-proposal" key={proposal.id}><span><b>{game.players[proposal.kind === "technology" ? proposal.seller : proposal.from].name}</b><small>{proposalSummary(game, proposal)}</small></span><button className="accept" disabled={busy} onClick={() => void onCommand({ kind: "respondProposal", proposalId: proposal.id, accept: true })}>Accept</button><button disabled={busy} onClick={() => void onCommand({ kind: "respondProposal", proposalId: proposal.id, accept: false })}>Reject</button></div>)}{!incoming.length && <p>No incoming proposals.</p>}<h4>Outgoing Proposals</h4>{outgoing.map((proposal) => <div className="network-proposal" key={proposal.id}><span><b>{proposalSummary(game, proposal)}</b><small>Awaiting response</small></span><button disabled={busy} onClick={() => void onCommand({ kind: "cancelProposal", proposalId: proposal.id })}>Cancel</button></div>)}{!outgoing.length && <p>No outgoing proposals.</p>}</section>
  </div>;
}
