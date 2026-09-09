import type {
  AgreementType,
  Resource,
  SecretOrder,
  TechnologyBranch,
  TradeBundle,
  TradableResource,
} from "../types";

/**
 * Commands are the only mutations a network client should submit.
 * The client never uploads an authoritative GameState.
 *
 * Player identity is intentionally absent from these payloads. The server
 * derives the acting player from the room token and overwrites proposal
 * ownership accordingly.
 */
export type RoomCommand =
  | { kind: "setReady"; ready: boolean }
  | { kind: "selectFaction"; factionId: string }
  | { kind: "startGame" }
  | { kind: "pauseGame" }
  | { kind: "resumeGame" }
  | { kind: "endGame" }
  | { kind: "convertSeatToBot"; playerId: number; profileId: string }
  | { kind: "convertSeatToHuman"; playerId: number }
  | { kind: "resetHumanSeat"; playerId: number }
  | { kind: "setSeatReady"; playerId: number; ready: boolean }
  | { kind: "postHostNotice"; message: string }
  | { kind: "setTurnTimer"; seconds: number | null }
  | { kind: "beginOrders" }
  | { kind: "drawHidden" }
  | { kind: "selectHidden"; cardId: string }
  | { kind: "setHiddenCompleted"; completed: boolean }
  | { kind: "claimUniversal"; objectiveId: string }
  | { kind: "claimCivilization"; objectiveId: string }
  | { kind: "submitOrders"; orders: SecretOrder[] }
  | { kind: "proposeTrade"; to: number; offer: TradeBundle; request: TradeBundle }
  | { kind: "proposeAgreement"; to: number; agreementType: AgreementType }
  | {
      kind: "proposeTechnology";
      buyer: number;
      branch: TechnologyBranch;
      level: number;
      compensation: Record<TradableResource, number>;
    }
  | { kind: "respondProposal"; proposalId: string; accept: boolean }
  | { kind: "cancelProposal"; proposalId: string }
  | { kind: "withdrawAgreement"; agreementId: string }
  | { kind: "breakAgreement"; agreementId: string }
  | { kind: "marketExchange"; give: Resource; get: Resource }
  | { kind: "politicalCapital"; output: "currency" | "material" | "labor" }
  | { kind: "economicSalvage" }
  | { kind: "setHomeProduction"; resource: "material" | "currency" | "research" }
  | { kind: "setStationingPermission"; guestId: number; permission: "defensive" | "envoy"; allowed: boolean }
  | { kind: "negotiationSurvey"; hexId: string }
  | { kind: "transferCombatUnit"; carrierId: string; direction: "load" | "unload"; amount?: number }
  | {
      kind: "surveyExchange";
      buyerId: number;
      hexId: string;
      price: number;
    }
  | {
      kind: "brokerTrade";
      a: number;
      b: number;
      aGives: TradeBundle;
      bGives: TradeBundle;
    }
  | { kind: "removeCapturedCenter"; centerIndex: number }
  | { kind: "redistributeCombatUnits"; hexId: string; assignments: { carrierId: string; cu: number }[]; stationed: number };

export type RoomCommandEnvelope = {
  token: string;
  expectedRevision: number;
  commandId: string;
  command: RoomCommand;
};

export type RoomCommandResult = {
  ok: boolean;
  message: string;
};

export function roomCommandLabel(command: RoomCommand): string {
  switch (command.kind) {
    case "setReady": return command.ready ? "Mark seat ready" : "Mark seat not ready";
    case "selectFaction": return "Select lobby faction";
    case "startGame": return "Start network game";
    case "pauseGame": return "Pause network game";
    case "resumeGame": return "Resume network game";
    case "endGame": return "End network game";
    case "convertSeatToBot": return "Assign bot takeover";
    case "convertSeatToHuman": return "Return seat to human control";
    case "resetHumanSeat": return "Reopen human seat";
    case "setSeatReady": return "Override seat readiness";
    case "postHostNotice": return "Post host notice";
    case "setTurnTimer": return "Set Turn timer";
    case "beginOrders": return "Begin Orders Phase";
    case "drawHidden": return "Draw Hidden Legacy choices";
    case "selectHidden": return "Select Hidden Legacy";
    case "setHiddenCompleted": return "Update Hidden Legacy completion";
    case "claimUniversal": return "Claim Universal Legacy";
    case "claimCivilization": return "Claim Civilization Legacy";
    case "submitOrders": return "Submit sealed Orders";
    case "proposeTrade": return "Propose trade";
    case "proposeAgreement": return "Propose agreement";
    case "proposeTechnology": return "Propose Technology Exchange";
    case "respondProposal": return command.accept ? "Accept proposal" : "Reject proposal";
    case "cancelProposal": return "Cancel proposal";
    case "withdrawAgreement": return "Schedule agreement withdrawal";
    case "breakAgreement": return "Break agreement immediately";
    case "marketExchange": return "System Market exchange";
    case "politicalCapital": return "Political Capital";
    case "economicSalvage": return "Economic Salvage";
    case "setHomeProduction": return "Set Homeworld production";
    case "setStationingPermission": return "Set vessel-hosting permission";
    case "negotiationSurvey": return "Farbound Negotiation Survey";
    case "transferCombatUnit": return `${command.direction === "load" ? "Load" : "Station"} CU`;
    case "surveyExchange": return "Survey Exchange";
    case "brokerTrade": return "Meridian Brokerage";
    case "removeCapturedCenter": return "Remove captured Center";
    case "redistributeCombatUnits": return "Redistribute surviving Combat Units";
  }
}

const commandKinds = new Set([
  "setReady", "selectFaction", "startGame", "pauseGame", "resumeGame", "endGame",
  "convertSeatToBot", "convertSeatToHuman", "resetHumanSeat", "setSeatReady", "postHostNotice", "setTurnTimer", "beginOrders", "drawHidden", "selectHidden", "setHiddenCompleted",
  "claimUniversal", "claimCivilization", "submitOrders", "proposeTrade",
  "proposeAgreement", "proposeTechnology", "respondProposal", "cancelProposal",
  "withdrawAgreement", "breakAgreement", "marketExchange", "politicalCapital",
  "economicSalvage", "setHomeProduction", "setStationingPermission", "negotiationSurvey", "transferCombatUnit", "surveyExchange", "brokerTrade",
  "removeCapturedCenter", "redistributeCombatUnits",
]);

/** Runtime boundary for untrusted JSON. Rules functions perform deeper legality checks. */
export function validateRoomCommand(value: unknown): RoomCommand {
  if (!value || typeof value !== "object") throw new Error("A room command object is required.");
  const command = value as Record<string, unknown>;
  if (typeof command.kind !== "string" || !commandKinds.has(command.kind))
    throw new Error("That room command kind is not supported.");
  const serialized = JSON.stringify(command);
  if (serialized.length > 50_000) throw new Error("That room command is too large.");
  const integerFields = ["playerId", "to", "buyer", "level", "centerIndex", "amount", "buyerId", "price", "a", "b", "guestId", "stationed"];
  for (const field of integerFields)
    if (field in command && (!Number.isInteger(command[field]) || Number(command[field]) < 0))
      throw new Error(`${field} must be a non-negative integer.`);
  const stringFields = ["cardId", "objectiveId", "proposalId", "agreementId", "carrierId", "hexId", "profileId", "factionId"];
  for (const field of stringFields)
    if (field in command && (typeof command[field] !== "string" || !(command[field] as string).trim() || (command[field] as string).length > 120))
      throw new Error(`${field} must be a short non-empty string.`);
  if (command.kind === "postHostNotice" && (typeof command.message !== "string" || !command.message.trim() || command.message.length > 240))
    throw new Error("Host notices must contain 1 to 240 characters.");
  if (command.kind === "setTurnTimer" && command.seconds !== null && (!Number.isInteger(command.seconds) || Number(command.seconds) < 60 || Number(command.seconds) > 86_400))
    throw new Error("Turn timers must be disabled or set from 1 minute to 24 hours.");
  if (command.kind === "setHomeProduction" && !["material", "currency", "research"].includes(String(command.resource)))
    throw new Error("Choose a valid Homeworld production resource.");
  if (["setReady", "setSeatReady"].includes(command.kind) && typeof command.ready !== "boolean")
    throw new Error("ready must be true or false.");
  if (command.kind === "setStationingPermission" && (typeof command.allowed !== "boolean" || !["defensive", "envoy"].includes(String(command.permission))))
    throw new Error("A valid permission and allowed flag are required.");
  if (command.kind === "submitOrders") {
    if (!Array.isArray(command.orders) || command.orders.length > 80)
      throw new Error("Orders must be an array containing no more than 80 entries.");
    for (const order of command.orders as unknown[]) {
      if (!order || typeof order !== "object" || typeof (order as Record<string, unknown>).kind !== "string" || typeof (order as Record<string, unknown>).id !== "string")
        throw new Error("Every sealed Order requires an id and kind.");
    }
  }
  return command as RoomCommand;
}
