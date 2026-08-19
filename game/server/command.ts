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
  | { kind: "selectHidden"; cardId: string }
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
  | { kind: "removeCapturedCenter"; centerIndex: number };

export type RoomCommandEnvelope = {
  token: string;
  expectedRevision: number;
  command: RoomCommand;
};

export type RoomCommandResult = {
  ok: boolean;
  message: string;
};

export function roomCommandLabel(command: RoomCommand): string {
  switch (command.kind) {
    case "selectHidden": return "Select Hidden Legacy";
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
    case "surveyExchange": return "Survey Exchange";
    case "brokerTrade": return "Meridian Brokerage";
    case "removeCapturedCenter": return "Remove captured Center";
  }
}
