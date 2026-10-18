"use client";

import { useState } from "react";
import {
  activeAgreements,
  agreementCost,
  agreementNames,
  agreementRules,
  blockadeConstructionCost,
  emptyTradeBundle,
  factionLibrary,
  habitatDistance,
  hasBenefit,
  hasStationingPermission,
  isContacted,
  legalBlockadeSaleDestinations,
  technologyBranches,
  technologyCost,
  technologyExchangeCost,
  tradeEligibility,
  projectedOrderBudget,
} from "../../../game";
import type {
  AgreementType,
  GameState,
  RoomCommand,
  TechnologyBranch,
  TradableResource,
  TradeBundle,
  SecretOrder,
} from "../../../game";
import { ResourceGlyph } from "./ResourceGlyph";

const tradeResources = ["material", "currency", "research", "labor"] as const;
const agreementTypes: AgreementType[] = ["trade", "nonAggression", "openBorders", "research", "defensive", "alliance"];
const balanceResources = ["material", "currency", "research", "influence", "labor"] as const;

function TradeForecast({ game, playerId, otherId, draft, give, receive }: {
  game: GameState; playerId: number; otherId: number; draft: SecretOrder[]; give: TradeBundle; receive: TradeBundle;
}) {
  const own = game.players[playerId], other = game.players[otherId];
  const reserved = projectedOrderBudget(game, playerId, draft);
  return <div className="trade-forecast">
    {[{ faction: own, balance: reserved.remaining, outgoing: give, incoming: receive, private: true }, { faction: other, balance: other, outgoing: receive, incoming: give, private: false }].map(({ faction, balance, outgoing, incoming, private: personal }) =>
      <section key={faction.id} style={{ "--trade-faction": faction.color } as React.CSSProperties}>
        <header><img src={factionLibrary[faction.faction]?.logo} alt=""/><div><b>{faction.name}</b><small>{personal ? "Your balance after drafted Orders" : "Public balance; private Orders checked on acceptance"}</small></div></header>
        <div className="trade-forecast-heading"><span>Resource</span><span>Available</span><span>Give</span><span>Receive</span><span>After</span></div>
        {balanceResources.map((resource) => { const available = resource === "labor" ? balance.labor : balance.resources[resource]; const after = available - (outgoing[resource] || 0) + (incoming[resource] || 0); return <div className={`trade-forecast-row resource-${resource} ${after < 0 ? "shortfall" : ""}`} key={resource}><span><ResourceGlyph resource={resource} label={false}/><small>{resource}</small></span><b>{available}</b><b>{outgoing[resource] || 0}</b><b>{incoming[resource] || 0}</b><strong>{after}</strong></div>; })}
      </section>)}
    {reserved.error && <p role="status">Draft budget: {reserved.error}</p>}
  </div>;
}

function describeBundle(bundle: TradeBundle) {
  return [...tradeResources.filter((resource) => bundle[resource] > 0)
    .map((resource) => `${bundle[resource]} ${resource}`), ...(bundle.influence ? [`${bundle.influence} influence`] : [])].join(", ") || "nothing";
}

function proposalSummary(game: GameState, proposal: GameState["proposals"][number], viewerId: number) {
  if (proposal.kind === "trade") {
    const incoming = proposal.to === viewerId;
    const youGive = incoming ? proposal.request : proposal.offer;
    const theyGive = incoming ? proposal.offer : proposal.request;
    const otherId = incoming ? proposal.from : proposal.to;
    if (proposal.blockadeCommission) return incoming
      ? `Aegis Blockade commission. Construction: 3 Material, 2 Currency, 2 Labor. Fee to Aegis: ${describeBundle(proposal.request)}. Choose a controlled deployment hex.`
      : `Commission a new Aegis Blockade for ${game.players[otherId].name}. Fee: ${describeBundle(proposal.request)}.`;
    if (proposal.blockadeId) return incoming
      ? `Aegis Blockade ${proposal.blockadeId}. You pay: ${describeBundle(proposal.request)}. Choose one of your controlled hexes for deployment.`
      : `Sell Aegis Blockade ${proposal.blockadeId} to ${game.players[otherId].name} for ${describeBundle(proposal.request)}.`;
    return `${proposal.counterOf ? "Counteroffer. " : ""}You give: ${describeBundle(youGive)}. ${game.players[otherId].name} gives: ${describeBundle(theyGive)}.`;
  }
  if (proposal.kind === "agreement") return agreementNames[proposal.agreementType];
  const total = technologyExchangeCost(game, proposal.buyer, proposal.branch, proposal.level, proposal.compensation);
  return `${proposal.branch} ${proposal.level}. Compensation to Helix: ${describeBundle({ ...proposal.compensation, labor: 0 })}. Total buyer cost: ${Object.entries(total).filter(([, amount]) => amount > 0).map(([resource, amount]) => `${amount} ${resource}`).join(", ")}. Counts as the buyer's Technology advance this Turn.`;
}

export default function NetworkDiplomacyPanel({
  game,
  playerId,
  busy,
  onCommand,
  initialTargetId,
  draft = [],
}: {
  game: GameState;
  playerId: number;
  busy: boolean;
  onCommand: (command: RoomCommand) => Promise<void>;
  initialTargetId?: number;
  draft?: SecretOrder[];
}) {
  const player = game.players[playerId];
  const rivals = game.players.filter((candidate) => candidate.id !== playerId);
  const [targetId, setTargetId] = useState(initialTargetId ?? rivals[0]?.id ?? 0);
  const [offer, setOffer] = useState<TradeBundle>(emptyTradeBundle);
  const [request, setRequest] = useState<TradeBundle>(emptyTradeBundle);
  const [counteringId, setCounteringId] = useState<string | null>(null);
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
  const [blockadeId, setBlockadeId] = useState("");
  const [blockadePrice, setBlockadePrice] = useState<TradeBundle>({ ...emptyTradeBundle(), currency: 1 });
  const [commissionFee, setCommissionFee] = useState<Record<TradableResource, number>>({ material: 0, currency: 1, research: 0 });
  const [blockadeDestinations, setBlockadeDestinations] = useState<Record<string, string>>({});
  const target = game.players[targetId] || rivals[0];
  const eligibility = target ? tradeEligibility(game, playerId, target.id) : undefined;
  const agreements = target ? activeAgreements(game, playerId, target.id) : [];
  const incoming = game.proposals.filter((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.buyer === playerId : proposal.to === playerId));
  const outgoing = game.proposals.filter((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.seller === playerId : proposal.from === playerId));
  const history = game.proposals.filter((proposal) => proposal.kind === "technology" ? proposal.seller === playerId || proposal.buyer === playerId : proposal.from === playerId || proposal.to === playerId).slice(-12).reverse();
  const sellable = technologyBranches.filter((item) => target && player.tech[item] > target.tech[item]);
  const activeBranch = sellable.includes(branch) ? branch : sellable[0];
  const transferTotal = activeBranch && target ? technologyExchangeCost(game, target.id, activeBranch, target.tech[activeBranch] + 1, compensation) : {};
  const transferReason = !eligibility?.ok ? eligibility?.message : target?.techAdvancedTurn === game.turn ? "The buyer already advanced Technology this Turn." : Object.entries(transferTotal).some(([resource, amount]) => (resource === "labor" ? target.labor : target.resources[resource as keyof typeof target.resources]) < amount) ? "The buyer cannot afford the combined cost and compensation." : "";
  const surveyTargets = game.hexes.filter((hex) => !hex.revealed && hex.kind !== "rift" && !player.privateSurveys.some((survey) => survey.hexId === hex.id));
  const activeSurveyTarget = surveyTargets.some((hex) => hex.id === surveyTarget) ? surveyTarget : surveyTargets[0]?.id || "";
  const tradableSurveys = player.privateSurveys.filter((survey) => (survey.tradableTurn === undefined || survey.tradableTurn === game.turn) && !game.hexes.find((hex) => hex.id === survey.hexId)?.revealed);
  const activeSurveyHex = tradableSurveys.some((survey) => survey.hexId === surveyHex) ? surveyHex : tradableSurveys[0]?.hexId || "";
  const sellableBlockades = game.blockades.filter((blockade) => blockade.owner === playerId && (blockade.active || blockade.carrierId) && blockade.readyTurn <= game.turn);
  const activeBlockadeId = sellableBlockades.some((blockade) => blockade.id === blockadeId) ? blockadeId : sellableBlockades[0]?.id || "";
  const normalizedBlockadePrice = Object.fromEntries(tradeResources.map((resource) => [resource, Math.max(0, Math.min(99, Math.trunc(Number(blockadePrice[resource]) || 0))) ])) as TradeBundle;
  const blockadePriceTotal = tradeResources.reduce((sum, resource) => sum + normalizedBlockadePrice[resource], 0);
  const blockadeLaborUnavailable = blockadePrice.labor > 0 && !!target && !hasBenefit(game, playerId, target.id, "trade");
  const commissionEligibility = target ? tradeEligibility(game, playerId, target.id) : undefined;
  const commissionAffordable = !!target && target.resources.material >= blockadeConstructionCost.material + commissionFee.material &&
    target.resources.currency >= blockadeConstructionCost.currency + commissionFee.currency &&
    target.resources.research >= commissionFee.research && target.labor >= blockadeConstructionCost.labor &&
    legalBlockadeSaleDestinations(game, target.id).length > 0;
  const available = projectedOrderBudget(game, playerId, draft);
  const offerShortfall = balanceResources.some((resource) => (offer[resource] || 0) > (resource === "labor" ? available.remaining.labor : available.remaining.resources[resource]));

  function setBundle(side: "offer" | "request", resource: typeof tradeResources[number], raw: string) {
    const amount = Math.max(0, Math.min(99, Number(raw) || 0));
    if (side === "offer") setOffer((current) => ({ ...current, [resource]: amount }));
    else setRequest((current) => ({ ...current, [resource]: amount }));
  }

  function beginCounter(proposal: Extract<GameState["proposals"][number], { kind: "trade" }>) {
    setTargetId(proposal.from);
    setOffer({ ...proposal.request });
    setRequest({ ...proposal.offer });
    setCounteringId(proposal.id);
  }

  async function sendTrade() {
    if (counteringId) await onCommand({ kind: "counterTrade", proposalId: counteringId, offer, request });
    else await onCommand({ kind: "proposeTrade", to: target.id, offer, request });
    setCounteringId(null);
    setOffer(emptyTradeBundle());
    setRequest(emptyTradeBundle());
  }

  if (!target) return <div className="network-empty">At least two civilizations are required.</div>;
  const distance = habitatDistance(game, playerId, target.id);

  return <div className="network-diplomacy">
    <header className="network-panel-header"><span>DIPLOMATIC NETWORK</span><h3>Trade, Treaties, and Proposals</h3><p>Diplomacy remains open throughout the Turn. Every accepted transaction is validated against the authoritative room state.</p></header>
    <div className="network-rivals">{rivals.map((rival) => <button key={rival.id} className={rival.id === target.id ? "active" : ""} onClick={() => { setTargetId(rival.id); setCounteringId(null); }} style={{ "--rival": rival.color } as React.CSSProperties}><img src={factionLibrary[rival.faction]?.logo} alt=""/><b>{rival.name}</b><small>{isContacted(game, playerId, rival.id) ? "Contact" : "Uncontacted"}</small></button>)}</div>
    <div className="network-relation"><span>Nearest Habitats <b>{distance === null ? "No route" : `${distance} hexes`}</b></span><span>Direct Trade <b className={eligibility?.ok ? "status-good" : "status-bad"}>{eligibility?.ok ? "Available" : "Unavailable"}</b></span><p>{eligibility?.message}</p></div>

    <section className="network-diplomacy-card trade-primary"><h4>{counteringId ? `Counteroffer to ${target.name}` : "Direct Trade"}</h4><p>Choose what you give and receive. Your available balance accounts for drafted Orders.</p><div className="network-trade-grid"><b>Resource</b><b>You give</b><b>You request</b>{tradeResources.map((resource) => <label key={resource}><span className={`resource-${resource}`}><ResourceGlyph resource={resource} label={false}/>{resource}</span><input aria-label={`Offer ${resource}`} type="number" min="0" value={offer[resource]} onChange={(event) => setBundle("offer", resource, event.target.value)} /><input aria-label={`Request ${resource}`} type="number" min="0" value={request[resource]} onChange={(event) => setBundle("request", resource, event.target.value)} /></label>)}{(player.faction === "aurelians" && player.tech.Policy >= 2 || target.faction === "aurelians" && target.tech.Policy >= 2) && <label><span className="resource-influence"><ResourceGlyph resource="influence" label={false}/>influence</span><input aria-label="Offer influence" type="number" min="0" max="99" disabled={player.faction !== "aurelians" || player.tech.Policy < 2} value={offer.influence || 0} onChange={(event) => setOffer((current) => ({ ...current, influence: Math.max(0, Math.min(99, Math.trunc(Number(event.target.value) || 0))) }))} /><input aria-label="Request influence" type="number" min="0" max="99" disabled={target.faction !== "aurelians" || target.tech.Policy < 2} value={request.influence || 0} onChange={(event) => setRequest((current) => ({ ...current, influence: Math.max(0, Math.min(99, Math.trunc(Number(event.target.value) || 0))) }))} /></label>}</div><TradeForecast game={game} playerId={playerId} otherId={target.id} draft={draft} give={offer} receive={request}/>{offerShortfall && <p role="status" className="trade-warning">Your offer exceeds the balance available after drafted Orders.</p>}<div className="trade-compose-actions"><button className="primary wide" disabled={busy || !eligibility?.ok || offerShortfall || !!available.error} onClick={() => void sendTrade()}>{counteringId ? "Send counteroffer" : "Send trade proposal"}</button>{counteringId && <button disabled={busy} onClick={() => setCounteringId(null)}>Cancel counter</button>}</div></section>

    {player.faction === "meridian" && <section className="network-diplomacy-card"><h4>Meridian · Brokered Exchange</h4><p>Propose a reciprocal exchange. Each civilization must approve before resources move. The Meridian earns 1 Currency from its first completed brokerage each Turn.</p><div className="network-broker-grid"><label>First party<select value={brokerA} onChange={(event) => setBrokerA(Number(event.target.value))}>{rivals.map((rival) => <option key={rival.id} value={rival.id}>{rival.name}</option>)}</select></label><label>Gives<select value={brokerAResource} onChange={(event) => setBrokerAResource(event.target.value as TradableResource)}>{(["material", "currency", "research"] as TradableResource[]).map((resource) => <option key={resource}>{resource}</option>)}</select></label><label>Second party<select value={brokerB} onChange={(event) => setBrokerB(Number(event.target.value))}>{rivals.map((rival) => <option key={rival.id} value={rival.id}>{rival.name}</option>)}</select></label><label>Gives<select value={brokerBResource} onChange={(event) => setBrokerBResource(event.target.value as TradableResource)}>{(["material", "currency", "research"] as TradableResource[]).map((resource) => <option key={resource}>{resource}</option>)}</select></label></div><button className="primary wide" disabled={busy || brokerA === brokerB || brokerAResource === brokerBResource} onClick={() => { const aGives = emptyTradeBundle(); const bGives = emptyTradeBundle(); aGives[brokerAResource] = 1; bGives[brokerBResource] = 1; void onCommand({ kind: "brokerTrade", a: brokerA, b: brokerB, aGives, bGives }); }}>Propose brokered exchange</button></section>}

    <section className="network-diplomacy-card"><h4>Policy · Formal Agreements</h4><select value={agreementType} onChange={(event) => setAgreementType(event.target.value as AgreementType)}>{agreementTypes.map((type) => <option key={type} value={type}>{agreementNames[type]}</option>)}</select><div className="agreement-rule"><b>{agreementRules[agreementType].effect}</b><small>Policy {agreementRules[agreementType].policy} required. You pay {agreementCost(game, playerId, agreementType)} Influence. They pay {agreementCost(game, target.id, agreementType)} Influence.</small></div><button className="primary wide" disabled={busy} onClick={() => void onCommand({ kind: "proposeAgreement", to: target.id, agreementType })}>Propose {agreementNames[agreementType]}</button><div className="network-agreements">{agreements.map((agreement) => <div key={agreement.id}><span><b>{agreementNames[agreement.type]}</b><small>{agreement.endsAfterTurn === game.turn ? "Withdrawal pending" : `Active since Turn ${agreement.startedTurn}`}</small></span><button disabled={busy || agreement.endsAfterTurn === game.turn} onClick={() => void onCommand({ kind: "withdrawAgreement", agreementId: agreement.id })}>Withdraw</button><button disabled={busy} onClick={() => void onCommand({ kind: "breakAgreement", agreementId: agreement.id })}>Break now</button></div>)}{!agreements.length && <small>No active agreements with this civilization.</small>}</div></section>

    {player.faction === "helix" && <section className="network-diplomacy-card"><h4>Helix Technology Exchange</h4><p>The buyer receives the next level of a branch you possess. This uses their one Technology advance for the Turn. Compensation is paid to you in addition to the normal exchange cost.</p>{activeBranch ? <><div className="helix-tech-progress">{technologyBranches.map((item) => <button type="button" key={item} className={activeBranch === item ? "active" : ""} disabled={!sellable.includes(item)} onClick={() => setBranch(item)}><b>{item}</b><span>You: {player.tech[item]} · {target.name}: {target.tech[item]}</span><small>{sellable.includes(item) ? `Offer ${item} ${target.tech[item] + 1}` : "No level available to offer"}</small></button>)}</div><select aria-label="Technology branch to offer" value={activeBranch} onChange={(event) => setBranch(event.target.value as TechnologyBranch)}>{sellable.map((item) => <option key={item}>{item}</option>)}</select><p>Offer {activeBranch} {target.tech[activeBranch] + 1}. Base buyer cost: {Object.entries(technologyCost(game, target.id, activeBranch, target.tech[activeBranch] + 1, true)).map(([resource, amount]) => `${amount} ${resource}`).join(" · ")}.</p><div className="network-compensation">{(["material", "currency", "research"] as TradableResource[]).map((resource) => <label key={resource}>Compensation: {resource}<input type="number" min="0" step="1" value={compensation[resource]} onChange={(event) => setCompensation((current) => ({ ...current, [resource]: Math.max(0, Math.floor(Number(event.target.value) || 0)) }))} /></label>)}</div><div className="helix-buyer-cost"><b>Buyer cost and ability to pay</b>{Object.entries(transferTotal).filter(([, amount]) => amount > 0).map(([resource, amount]) => { const held = resource === "labor" ? target.labor : target.resources[resource as keyof typeof target.resources]; return <span key={resource} className={`resource-${resource} ${held < amount ? "shortfall" : ""}`}><ResourceGlyph resource={resource as "material" | "currency" | "research" | "influence" | "labor"} label={false}/>{amount} required · {held} held</span>; })}</div>{transferReason && <p role="status">{transferReason}</p>}<button className="primary wide" disabled={busy || !!transferReason} onClick={() => void onCommand({ kind: "proposeTechnology", buyer: target.id, branch: activeBranch, level: target.tech[activeBranch] + 1, compensation })}>Offer Technology to {target.name}</button></> : <p>You do not currently possess a Technology level above this civilization.</p>}</section>}

    {player.faction === "aegis" && <section className="network-diplomacy-card">
      <h4>Commission an Aegis Blockade</h4>
      <p>At Economy II, offer a new Blockade without constructing one first. The buyer pays 3 Material, 2 Currency, and 2 Labor to build it at their chosen controlled hex. Your fee is paid to you on acceptance.</p>
      {player.tech.Economy < 2 ? <p role="status">Advance to Economy II to offer Blockade commissions.</p> : <>
        <div className="network-compensation">{(["material", "currency", "research"] as TradableResource[]).map((resource) => <label key={resource}>Fee: {resource}<input type="number" inputMode="numeric" min="0" max="99" step="1" value={commissionFee[resource]} onChange={(event) => setCommissionFee((current) => ({ ...current, [resource]: Math.max(0, Math.min(99, Math.trunc(Number(event.target.value) || 0))) }))} /></label>)}</div>
        <p>Buyer total: {blockadeConstructionCost.material + commissionFee.material} Material, {blockadeConstructionCost.currency + commissionFee.currency} Currency, {commissionFee.research} Research, {blockadeConstructionCost.labor} Labor.</p>
        {!commissionEligibility?.ok && <p role="status">{commissionEligibility?.message}</p>}
        {commissionEligibility?.ok && !commissionAffordable && <p role="status">The buyer needs enough resources, Labor, and an available controlled hex.</p>}
        <button className="primary wide" disabled={busy || !commissionEligibility?.ok || !commissionAffordable} onClick={() => void onCommand({ kind: "proposeBlockadeCommission", buyer: target.id, fee: commissionFee })}>Offer new Blockade to {target.name}</button>
      </>}
      {sellableBlockades.length > 0 && <>
        <h4>Sell an existing Blockade</h4>
        <p>An existing deployed or loaded Blockade can still be sold to an agreement partner. The buyer chooses its destination.</p>
        <select aria-label="Blockade to sell" value={activeBlockadeId} onChange={(event) => setBlockadeId(event.target.value)}>{sellableBlockades.map((blockade) => <option key={blockade.id} value={blockade.id}>{blockade.id} · {blockade.carrierId ? `loaded on ${blockade.carrierId}` : `deployed at ${blockade.hex}`}</option>)}</select>
        <div className="network-compensation">{tradeResources.map((resource) => <label key={resource}>Price: {resource}<input type="number" inputMode="numeric" min="0" max="99" step="1" value={blockadePrice[resource]} onChange={(event) => setBlockadePrice((current) => ({ ...current, [resource]: Math.max(0, Math.min(99, Math.trunc(Number(event.target.value) || 0))) }))} /></label>)}</div>
        {!agreements.length && <p role="status">Establish an agreement with {target.name} to transfer an existing Blockade.</p>}
        {blockadeLaborUnavailable && <p role="status">Labor prices require a Trade Agreement or Alliance.</p>}
        <button className="primary wide" disabled={busy || player.tech.Economy < 2 || !agreements.length || !activeBlockadeId || blockadePriceTotal === 0 || blockadeLaborUnavailable} onClick={() => void onCommand({ kind: "proposeBlockadeSale", buyer: target.id, blockadeId: activeBlockadeId, price: normalizedBlockadePrice })}>Sell existing Blockade to {target.name}</button>
      </>}
    </section>}

    {player.faction === "aurelians" && <section className="network-diplomacy-card"><h4>Political Capital</h4><div className="network-button-grid">{(["currency", "material", "labor"] as const).map((output) => <button disabled={busy} key={output} onClick={() => void onCommand({ kind: "politicalCapital", output })}>Influence to {output}</button>)}</div></section>}

    {player.faction === "farbound" && <section className="network-diplomacy-card"><h4>Farbound Negotiation Survey</h4><p>Gather one private survey before sealing Orders. The resulting intelligence may be traded this Turn.</p><select value={activeSurveyTarget} disabled={!surveyTargets.length || player.negotiationSurveyUsedTurn === game.turn} onChange={(event) => setSurveyTarget(event.target.value)}>{surveyTargets.map((hex) => <option key={hex.id} value={hex.id}>{hex.id}</option>)}</select><button className="primary wide" disabled={busy || !activeSurveyTarget || player.negotiationSurveyUsedTurn === game.turn} onClick={() => void onCommand({ kind: "negotiationSurvey", hexId: activeSurveyTarget })}>{player.negotiationSurveyUsedTurn === game.turn ? "Survey gathered this Turn" : "Gather private survey"}</button><h4>Survey Exchange</h4>{tradableSurveys.length ? <><select value={activeSurveyHex} onChange={(event) => setSurveyHex(event.target.value)}>{tradableSurveys.map((survey) => <option key={survey.hexId} value={survey.hexId}>{survey.hexId}</option>)}</select><label className="network-inline-field">Price in Currency<input type="number" min="0" value={surveyPrice} onChange={(event) => setSurveyPrice(Math.max(0, Number(event.target.value) || 0))} /></label><button className="primary wide" disabled={busy || !activeSurveyHex} onClick={() => void onCommand({ kind: "surveyExchange", buyerId: target.id, hexId: activeSurveyHex, price: surveyPrice })}>Sell survey to {target.name}</button></> : <p>No survey gathered for trade this Turn.</p>}</section>}


    {(game.brokerageOffers || []).some((offer) => [offer.meridianId, offer.a, offer.b].includes(playerId)) && <section className="network-diplomacy-card proposal-queue"><h4>Brokered Exchanges</h4>{[...(game.brokerageOffers || [])].reverse().slice(0, 12).map((offer) => {
      const isBroker = offer.meridianId === playerId;
      if (!isBroker && offer.a !== playerId && offer.b !== playerId) return null;
      const active = offer.status === "pending" && offer.createdTurn === game.turn;
      const gives = offer.a === playerId ? offer.aGives : offer.bGives;
      const gets = offer.a === playerId ? offer.bGives : offer.aGives;
      const waiting = active && !isBroker && !offer.approvedBy.includes(playerId);
      return <div className="network-proposal" key={offer.id}><span><b>{game.players[offer.meridianId].name} · {game.players[offer.a].name} ↔ {game.players[offer.b].name}</b><small>{isBroker ? `${game.players[offer.a].name} gives ${describeBundle(offer.aGives)}; ${game.players[offer.b].name} gives ${describeBundle(offer.bGives)}.` : `You give ${describeBundle(gives)} and receive ${describeBundle(gets)}.`} {active ? `Approved: ${offer.approvedBy.length}/2` : offer.status === "pending" ? "Expired" : offer.status}.</small></span>{waiting && <><button className="accept" disabled={busy} onClick={() => void onCommand({ kind: "respondBrokerage", offerId: offer.id, accept: true })}>Approve</button><button disabled={busy} onClick={() => void onCommand({ kind: "respondBrokerage", offerId: offer.id, accept: false })}>Decline</button></>}{isBroker && active && <button disabled={busy} onClick={() => void onCommand({ kind: "cancelBrokerage", offerId: offer.id })}>Withdraw</button>}</div>;
    })}</section>}

    <section className="network-diplomacy-card proposal-queue"><h4>Incoming Proposals</h4>{incoming.map((proposal) => {
      const destinations = proposal.kind === "trade" && (proposal.blockadeId || proposal.blockadeCommission) ? legalBlockadeSaleDestinations(game, playerId) : [];
      const destination = destinations.some((hex) => hex.id === blockadeDestinations[proposal.id]) ? blockadeDestinations[proposal.id] : destinations[0]?.id || "";
      return <div className="network-proposal" key={proposal.id}><span><b>{game.players[proposal.kind === "technology" ? proposal.seller : proposal.from].name}</b><small>{proposalSummary(game, proposal, playerId)}</small>{proposal.kind === "trade" && <TradeForecast game={game} playerId={playerId} otherId={proposal.from} draft={draft} give={proposal.request} receive={proposal.offer}/>}{proposal.kind === "trade" && (proposal.blockadeId || proposal.blockadeCommission) && <label className="blockade-destination">Deploy purchased Blockade<select aria-label={`Destination for ${proposal.blockadeId || "commission"}`} value={destination} disabled={!destinations.length} onChange={(event) => setBlockadeDestinations((current) => ({ ...current, [proposal.id]: event.target.value }))}>{destinations.map((hex) => <option key={hex.id} value={hex.id}>{hex.id}{hex.tier ? ` · ${hex.tier}` : ""}</option>)}</select></label>}</span><button className="accept" disabled={busy || (proposal.kind === "trade" && !!(proposal.blockadeId || proposal.blockadeCommission) && !destination)} onClick={() => void onCommand({ kind: "respondProposal", proposalId: proposal.id, accept: true, ...(proposal.kind === "trade" && (proposal.blockadeId || proposal.blockadeCommission) ? { blockadeDestinationHexId: destination } : {}) })}>Accept</button>{proposal.kind === "trade" && !proposal.blockadeId && !proposal.blockadeCommission && <button disabled={busy || (proposal.counterDepth || 0) >= 3} onClick={() => beginCounter(proposal)}>Counter</button>}<button disabled={busy} onClick={() => void onCommand({ kind: "respondProposal", proposalId: proposal.id, accept: false })}>Reject</button></div>;
    })}{!incoming.length && <p>No incoming proposals.</p>}<h4>Outgoing Proposals</h4>{outgoing.map((proposal) => <div className="network-proposal" key={proposal.id}><span><b>{proposalSummary(game, proposal, playerId)}</b><small>Awaiting response</small>{proposal.kind === "trade" && <TradeForecast game={game} playerId={playerId} otherId={proposal.to} draft={draft} give={proposal.offer} receive={proposal.request}/>}</span><button disabled={busy} onClick={() => void onCommand({ kind: "cancelProposal", proposalId: proposal.id })}>Cancel</button></div>)}{!outgoing.length && <p>No outgoing proposals.</p>}</section>
    <section className="network-diplomacy-card proposal-history"><h4>Negotiation History</h4>{history.map((proposal) => <div key={proposal.id}><span><b>{proposal.kind === "trade" && proposal.counterOf ? `Revision ${proposal.counterDepth || 1}` : proposal.kind}</b><small>{proposalSummary(game, proposal, playerId)}</small></span><mark data-status={proposal.status}>{proposal.status}</mark></div>)}{!history.length && <p>No diplomatic proposals have been exchanged.</p>}</section>
    {(hasBenefit(game, playerId, target.id, "defensive") || target.faction === "aurelians") && <section className="network-diplomacy-card"><h4>Vessel hosting permissions</h4><p>Permission is directional. A Defensive Pact alone does not authorize co-stationing.</p>{hasBenefit(game, playerId, target.id, "defensive") && <button className="primary wide" disabled={busy} onClick={() => void onCommand({ kind: "setStationingPermission", guestId: target.id, permission: "defensive", allowed: !hasStationingPermission(game, playerId, target.id, "defensive") })}>{hasStationingPermission(game, playerId, target.id, "defensive") ? "Revoke defensive co-stationing" : "Allow defensive co-stationing"}</button>}{target.faction === "aurelians" && <button className="primary wide" disabled={busy} onClick={() => void onCommand({ kind: "setStationingPermission", guestId: target.id, permission: "envoy", allowed: !hasStationingPermission(game, playerId, target.id, "envoy") })}>{hasStationingPermission(game, playerId, target.id, "envoy") ? "Revoke Envoy hosting" : "Allow Envoy hosting"}</button>}</section>}
    <section className="network-diplomacy-card diplomacy-status-card">
      <h4>{target.name} current status</h4>
      <div className="diplomacy-status-grid">
        <span><small>Legacy</small><b>{target.lp} LP</b></span>
        <span><small>Resources</small><b>{target.resources.material}M · {target.resources.currency}C · {target.resources.research}R · {target.resources.influence}I</b></span>
        <span><small>Labor</small><b>{target.labor}/{target.laborCap}</b></span>
        <span><small>Habitats</small><b>{game.hexes.filter((hex) => hex.owner === target.id && hex.tier).length}</b></span>
        <span><small>Military vessels</small><b>{game.carriers.filter((carrier) => carrier.owner === target.id).length}</b></span>
        <span><small>Technology</small><b>{Object.entries(target.tech).map(([branch, level]) => `${branch[0]}${level}`).join(" · ")}</b></span>
      </div>
      <p>{agreements.length ? `Active agreements: ${agreements.map((agreement) => agreementNames[agreement.type]).join(", ")}.` : "No active formal agreements with this civilization."}</p>
    </section>
  </div>;
}
