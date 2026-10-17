import type {
  AgreementType,
  Resource,
  SecretOrder,
  TechnologyBranch,
  TradeBundle,
  TradableResource,
} from "../types";
import type { ChatAttachment } from "./types";

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
  | { kind: "setBotFaction"; playerId: number; factionId?: string; random: boolean }
  | { kind: "startGame" }
  | { kind: "pauseGame" }
  | { kind: "resumeGame" }
  | { kind: "endGame" }
  | { kind: "submitFeedback"; rating: number; difficulty: number; wouldPlayAgain: boolean; issueTags: string[]; note: string }
  | { kind: "convertSeatToBot"; playerId: number; profileId: string }
  | { kind: "setBotDifficulty"; playerId: number; profileId: string }
  | { kind: "convertSeatToHuman"; playerId: number }
  | { kind: "resetHumanSeat"; playerId: number }
  | { kind: "setSeatReady"; playerId: number; ready: boolean }
  | { kind: "postHostNotice"; message: string }
  | { kind: "setTurnTimer"; seconds: number | null }
  | { kind: "setAutoStart"; enabled: boolean }
  | { kind: "setRoomName"; name: string }
  | { kind: "transferHost"; playerId: number }
  | { kind: "beginOrders" }
  | { kind: "unsealOrders" }
  | { kind: "drawHidden" }
  | { kind: "selectHidden"; cardId: string }
  | { kind: "setHiddenCompleted"; completed: boolean }
  | { kind: "claimUniversal"; objectiveId: string }
  | { kind: "claimCivilization"; objectiveId: string }
  | { kind: "submitOrders"; orders: SecretOrder[] }
  | { kind: "saveDraft"; orders: SecretOrder[] }
  | { kind: "advanceTutorial" }
  | { kind: "dismissTutorial" }
  | { kind: "tutorialEvent"; event: "panel-opened" | "hex-inspected"; value: string }
  | { kind: "advanceAcademy" }
  | { kind: "restartAcademyStage" }
  | { kind: "dismissAcademy" }
  | { kind: "showAcademy" }
  | { kind: "academyEvent"; event: "panel-opened"; value: string }
  | { kind: "proposeTrade"; to: number; offer: TradeBundle; request: TradeBundle }
  | { kind: "proposeBlockadeSale"; buyer: number; blockadeId: string; price: TradeBundle }
  | { kind: "proposeBlockadeCommission"; buyer: number; fee: Record<TradableResource, number> }
  | { kind: "counterTrade"; proposalId: string; offer: TradeBundle; request: TradeBundle }
  | { kind: "proposeAgreement"; to: number; agreementType: AgreementType }
  | {
      kind: "proposeTechnology";
      buyer: number;
      branch: TechnologyBranch;
      level: number;
      compensation: Record<TradableResource, number>;
    }
  | { kind: "respondProposal"; proposalId: string; accept: boolean; blockadeDestinationHexId?: string }
  | { kind: "respondBrokerage"; offerId: string; accept: boolean }
  | { kind: "cancelBrokerage"; offerId: string }
  | { kind: "cancelProposal"; proposalId: string }
  | { kind: "createChat"; participantIds: number[]; name?: string }
  | { kind: "sendChat"; channelId: string; text: string; attachment?: ChatAttachment }
  | { kind: "markChatRead"; channelId: string; sequence: number }
  | { kind: "setChatMuted"; channelId: string; muted: boolean }
  | { kind: "setPlayerBlocked"; playerId: number; blocked: boolean }
  | { kind: "reportChatMessage"; messageId: string; reason: string }
  | { kind: "setGatePledge"; amount: number }
  | { kind: "reviewChatReport"; reportId: string; action: "dismiss" | "remove" }
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
    case "setBotFaction": return command.random ? "Set bot faction to random" : "Set bot faction";
    case "startGame": return "Start network game";
    case "pauseGame": return "Pause network game";
    case "resumeGame": return "Resume network game";
    case "endGame": return "End network game";
    case "submitFeedback": return "Submit private playtest feedback";
    case "convertSeatToBot": return "Assign bot takeover";
    case "setBotDifficulty": return "Set bot difficulty";
    case "convertSeatToHuman": return "Return seat to human control";
    case "resetHumanSeat": return "Reopen human seat";
    case "setSeatReady": return "Override seat readiness";
    case "postHostNotice": return "Post host notice";
    case "setTurnTimer": return "Set Turn timer";
    case "setAutoStart": return command.enabled ? "Enable automatic launch" : "Disable automatic launch";
    case "setRoomName": return "Rename room";
    case "transferHost": return "Transfer room host";
    case "beginOrders": return "Begin Orders Phase";
    case "unsealOrders": return "Reopen private Orders";
    case "drawHidden": return "Draw Hidden Legacy choices";
    case "selectHidden": return "Select Hidden Legacy";
    case "setHiddenCompleted": return "Update Hidden Legacy completion";
    case "claimUniversal": return "Claim Universal Legacy";
    case "claimCivilization": return "Claim Civilization Legacy";
    case "submitOrders": return "Submit sealed Orders";
    case "saveDraft": return "Save private Order draft";
    case "advanceTutorial": return "Advance First Horizon lesson";
    case "dismissTutorial": return "Hide First Horizon guidance";
    case "tutorialEvent": return `Record First Horizon ${command.event}`;
    case "advanceAcademy": return "Complete Academy exercise";
    case "restartAcademyStage": return "Restart Academy exercise";
    case "dismissAcademy": return "Hide Academy guidance";
    case "showAcademy": return "Show Academy guidance";
    case "academyEvent": return `Record Academy ${command.event}`;
    case "proposeTrade": return "Propose trade";
    case "proposeBlockadeSale": return "Offer Aegis Blockade sale";
    case "proposeBlockadeCommission": return "Offer Aegis Blockade commission";
    case "counterTrade": return "Counter trade proposal";
    case "proposeAgreement": return "Propose agreement";
    case "proposeTechnology": return "Propose Technology Exchange";
    case "respondProposal": return command.accept ? "Accept proposal" : "Reject proposal";
    case "cancelProposal": return "Cancel proposal";
    case "createChat": return "Create match conversation";
    case "sendChat": return "Send match message";
    case "markChatRead": return "Mark conversation read";
    case "setChatMuted": return command.muted ? "Mute conversation" : "Unmute conversation";
    case "setPlayerBlocked": return command.blocked ? "Block match messages" : "Unblock match messages";
    case "reportChatMessage": return "Report match message";
    case "setGatePledge": return "Set public Gate pledge";
    case "reviewChatReport": return "Review chat report";
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
    case "respondBrokerage": return command.accept ? "Approve Brokerage" : "Decline Brokerage";
    case "cancelBrokerage": return "Withdraw Brokerage";
    case "removeCapturedCenter": return "Remove captured Center";
    case "redistributeCombatUnits": return "Redistribute surviving Combat Units";
  }
}

const commandKinds = new Set([
  "unsealOrders",
  "setReady", "selectFaction", "setBotFaction", "startGame", "pauseGame", "resumeGame", "endGame",
  "submitFeedback",
  "convertSeatToBot", "setBotDifficulty", "convertSeatToHuman", "resetHumanSeat", "setSeatReady", "postHostNotice", "setTurnTimer", "setAutoStart", "setRoomName", "transferHost", "beginOrders", "drawHidden", "selectHidden", "setHiddenCompleted",
  "claimUniversal", "claimCivilization", "submitOrders", "saveDraft", "advanceTutorial", "dismissTutorial", "tutorialEvent", "advanceAcademy", "restartAcademyStage", "dismissAcademy", "showAcademy", "academyEvent", "proposeTrade", "proposeBlockadeSale", "proposeBlockadeCommission",
  "counterTrade", "proposeAgreement", "proposeTechnology", "respondProposal", "cancelProposal",
  "createChat", "sendChat", "markChatRead", "setChatMuted", "setPlayerBlocked", "reportChatMessage",
  "setGatePledge",
  "reviewChatReport",
  "withdrawAgreement", "breakAgreement", "marketExchange", "politicalCapital",
  "economicSalvage", "setHomeProduction", "setStationingPermission", "negotiationSurvey", "transferCombatUnit", "surveyExchange", "brokerTrade", "respondBrokerage", "cancelBrokerage",
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
  const integerFields = ["playerId", "to", "buyer", "level", "centerIndex", "amount", "buyerId", "a", "b", "guestId", "stationed", "sequence"];
  for (const field of integerFields)
    if (field in command && (!Number.isInteger(command[field]) || Number(command[field]) < 0))
      throw new Error(`${field} must be a non-negative integer.`);
  const stringFields = ["cardId", "objectiveId", "proposalId", "agreementId", "carrierId", "blockadeId", "blockadeDestinationHexId", "hexId", "profileId", "factionId", "event", "value", "channelId", "messageId", "reportId"];
  for (const field of stringFields)
    if (field in command && (typeof command[field] !== "string" || !(command[field] as string).trim() || (command[field] as string).length > 120))
      throw new Error(`${field} must be a short non-empty string.`);
  if (command.kind === "postHostNotice" && (typeof command.message !== "string" || !command.message.trim() || command.message.length > 240))
    throw new Error("Host notices must contain 1 to 240 characters.");
  if (command.kind === "createChat") {
    if (!Array.isArray(command.participantIds) || command.participantIds.length < 2 || command.participantIds.length > 6 || command.participantIds.some((id) => !Number.isInteger(id) || Number(id) < 0))
      throw new Error("A conversation requires two to six valid participants.");
    if (command.name !== undefined && (typeof command.name !== "string" || command.name.trim().length > 40))
      throw new Error("Conversation names must be no more than 40 characters.");
  }
  if (command.kind === "sendChat" && (typeof command.text !== "string" || !command.text.trim() || command.text.trim().length > 1000))
    throw new Error("Messages must contain 1 to 1000 characters.");
  if (command.kind === "reportChatMessage" && (typeof command.reason !== "string" || !command.reason.trim() || command.reason.trim().length > 240))
    throw new Error("Reports require a reason of no more than 240 characters.");
  if (command.kind === "submitFeedback") {
    if (!Number.isInteger(command.rating) || Number(command.rating) < 1 || Number(command.rating) > 5)
      throw new Error("Overall rating must be between one and five.");
    if (!Number.isInteger(command.difficulty) || Number(command.difficulty) < 1 || Number(command.difficulty) > 5)
      throw new Error("Difficulty rating must be between one and five.");
    if (typeof command.wouldPlayAgain !== "boolean") throw new Error("Play-again feedback must be true or false.");
    const allowed = new Set(["rules", "interface", "balance", "performance", "connection", "accessibility"]);
    if (!Array.isArray(command.issueTags) || command.issueTags.length > 6 || command.issueTags.some((tag) => typeof tag !== "string" || !allowed.has(tag)))
      throw new Error("Choose only supported playtest issue categories.");
    if (typeof command.note !== "string" || command.note.trim().length > 1000)
      throw new Error("Playtest notes must be no more than 1000 characters.");
  }
  if (command.kind === "reviewChatReport" && !["dismiss", "remove"].includes(String(command.action)))
    throw new Error("Choose a valid moderation action.");
  if (command.kind === "sendChat" && command.attachment) {
    const attachment = command.attachment as Record<string, unknown>;
    if (typeof attachment !== "object" || !["proposal", "hex"].includes(String(attachment.kind)))
      throw new Error("Choose a valid message attachment.");
    const reference = attachment.kind === "proposal" ? attachment.proposalId : attachment.hexId;
    if (typeof reference !== "string" || !reference.trim() || reference.length > 120)
      throw new Error("Message attachments require a valid reference.");
  }
  if (["setChatMuted", "setPlayerBlocked"].includes(command.kind) && typeof command.muted !== "boolean" && typeof command.blocked !== "boolean")
    throw new Error("That communication preference requires a boolean value.");
  if (command.kind === "setTurnTimer" && command.seconds !== null && (!Number.isInteger(command.seconds) || Number(command.seconds) < 60 || Number(command.seconds) > 172_800))
    throw new Error("Turn timers must be disabled or set from 1 minute to 48 hours.");
  if (command.kind === "setAutoStart" && typeof command.enabled !== "boolean")
    throw new Error("Automatic launch must be enabled or disabled.");
  if (command.kind === "setRoomName" && (typeof command.name !== "string" || command.name.trim().length > 48))
    throw new Error("Room names must contain no more than 48 characters.");
  if (command.kind === "setGatePledge" && (!Number.isInteger(command.amount) || Number(command.amount) < 0 || Number(command.amount) > 9))
    throw new Error("Gate pledges must be between zero and nine Tributes.");
  if (command.kind === "tutorialEvent" && !["panel-opened", "hex-inspected"].includes(String(command.event)))
    throw new Error("Choose a valid First Horizon interaction event.");
  if (command.kind === "academyEvent" && command.event !== "panel-opened")
    throw new Error("Choose a valid Horizon Academy interaction event.");
  if (command.kind === "proposeBlockadeSale") {
    if (!command.price || typeof command.price !== "object") throw new Error("A Blockade sale requires a valid price.");
    for (const resource of ["material", "currency", "research", "labor"])
      if (!Number.isInteger((command.price as Record<string, unknown>)[resource]) || Number((command.price as Record<string, unknown>)[resource]) < 0 || Number((command.price as Record<string, unknown>)[resource]) > 99)
        throw new Error("Blockade prices must use whole resource amounts from zero to 99.");
  }
  if (command.kind === "proposeBlockadeCommission") {
    if (!command.fee || typeof command.fee !== "object") throw new Error("A Blockade commission requires a fee bundle.");
    for (const resource of ["material", "currency", "research"])
      if (!Number.isInteger((command.fee as Record<string, unknown>)[resource]) || Number((command.fee as Record<string, unknown>)[resource]) < 0 || Number((command.fee as Record<string, unknown>)[resource]) > 99)
        throw new Error("Blockade fees must use whole resource amounts from zero to 99.");
  }
  if (command.kind === "surveyExchange" && (!Number.isInteger(command.price) || Number(command.price) < 0))
    throw new Error("price must be a non-negative integer.");
  if (command.kind === "setHomeProduction" && !["material", "currency", "research"].includes(String(command.resource)))
    throw new Error("Choose a valid Homeworld production resource.");
  if (["setReady", "setSeatReady"].includes(command.kind) && typeof command.ready !== "boolean")
    throw new Error("ready must be true or false.");
  if (command.kind === "setStationingPermission" && (typeof command.allowed !== "boolean" || !["defensive", "envoy"].includes(String(command.permission))))
    throw new Error("A valid permission and allowed flag are required.");
  if (command.kind === "submitOrders" || command.kind === "saveDraft") {
    if (!Array.isArray(command.orders) || command.orders.length > 80)
      throw new Error("Orders must be an array containing no more than 80 entries.");
    for (const order of command.orders as unknown[]) {
      if (!order || typeof order !== "object" || typeof (order as Record<string, unknown>).kind !== "string" || typeof (order as Record<string, unknown>).id !== "string")
        throw new Error("Every sealed Order requires an id and kind.");
    }
  }
  return command as RoomCommand;
}
