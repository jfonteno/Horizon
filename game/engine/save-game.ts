import type { CarrierState, GameState } from "../types";
import { emptyLegacyBreakdown, emptyLegacyMetrics } from "../rules/legacy";

export const SAVE_KEY = "horizon-local-playtest";
export function loadGame(): GameState | null {
  const raw =
    localStorage.getItem(SAVE_KEY) ||
    localStorage.getItem("horizon-shattered-reach");
  if (!raw) return null;
  try {
    const legacy = JSON.parse(raw) as GameState & {
      moves?: { explorer: number; colony: number; patrol?: number };
    };
    const schemaVersion = legacy.schemaVersion || 1;
    const migratedCarriers: CarrierState[] =
      legacy.carriers ||
      legacy.players.map((player, index) => {
        const old = player as typeof player & {
          patrol?: string;
          patrolCU?: number;
        };
        return {
          id: `carrier-${player.id}-${index + 1}`,
          owner: player.id,
          type: "patrol",
          hex:
            old.patrol ||
            legacy.hexes.find((hex) => hex.owner === player.id && hex.tier)
              ?.id ||
            legacy.selected,
          cu: Math.max(1, old.patrolCU || 2),
          readyTurn: legacy.turn || 1,
          movesRemaining:
            player.id === legacy.active ? (legacy.moves?.patrol ?? 2) : 0,
        };
      });
    return {
      ...legacy,
      schemaVersion: 13,
      mapId: legacy.mapId || "shattered-reach",
      themeId: legacy.themeId || "horizon-base",
      hexes: (schemaVersion < 3
        ? legacy.hexes.map((hex) =>
            hex.kind === "hazard" ? { ...hex, kind: "empty" as const } : hex,
          )
        : legacy.hexes
      ).map((hex) => ({
        ...hex,
        pendingCombat: hex.pendingCombat || [],
        surveyedBy: hex.surveyedBy || [],
        originalOwner:
          hex.originalOwner ?? (hex.kind === "home" ? hex.owner : undefined),
      })),
      players: legacy.players.map((player) => {
        const defaults = emptyLegacyMetrics(),
          metrics = player.legacyMetrics || defaults;
        return {
          ...player,
          controller: player.controller || { kind: "human" },
          laborBonus: player.laborBonus || 0,
          disabled: schemaVersion < 3 ? false : player.disabled,
          legacy: player.legacy || {
            ...emptyLegacyBreakdown(),
            manual: player.lp || 0,
          },
          legacyMetrics: {
            ...defaults,
            ...metrics,
            productionAmounts:
              metrics.productionAmounts || defaults.productionAmounts,
            givenResearch: metrics.givenResearch || defaults.givenResearch,
          },
          civilizationClaims: player.civilizationClaims || [],
          hiddenLegacy: player.hiddenLegacy || {},
          privateSurveys: player.privateSurveys || [],
          diplomacy: {
            contacts: [],
            firstAgreementPartners: [],
            firstTradeAgreementUsed: false,
            politicalLaborEras: [],
            researchDiscountEras: [],
            technologyExportPartners: [],
            bonusInfluenceGained: 0,
            ...player.diplomacy,
          },
        };
      }),
      moves: {
        explorer: legacy.moves?.explorer ?? 1,
        colony: legacy.moves?.colony ?? 1,
      },
      mode: "inspect",
      carriers: migratedCarriers,
      civilianUnits: legacy.civilianUnits || [],
      selectedCarrierIds:
        legacy.selectedCarrierIds ||
        migratedCarriers
          .filter((carrier) => carrier.owner === legacy.active)
          .slice(0, 1)
          .map((carrier) => carrier.id),
      agreements: legacy.agreements || [],
      proposals: legacy.proposals || [],
      pendingLabor: legacy.pendingLabor || [],
      universalClaims: legacy.universalClaims || [],
      botReports: (legacy.botReports || []).map((report) => ({ ...report, strategicForecast: report.strategicForecast || [] })),
      botMemory: legacy.botMemory || [],
      spectatorMode: legacy.spectatorMode || false,
      history: legacy.history || [],
      orderProtocol: legacy.orderProtocol ? {
        ...legacy.orderProtocol,
        phase: legacy.orderProtocol.phase === "negotiation" ? "orders" : legacy.orderProtocol.phase,
      } : {
        phase: "orders",
        turn: legacy.turn || 1,
        currentPlayer: legacy.active || 0,
        submissions: [],
        lastResolution: [],
      },
    };
  } catch {
    return null;
  }
}
export function saveGame(game: GameState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(game));
}
export function clearGame() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem("horizon-shattered-reach");
}
