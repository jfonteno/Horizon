import type { CarrierState, GameState } from "../types";
import { factionLibrary } from "../factions";
import { emptyLegacyBreakdown, emptyLegacyMetrics } from "../rules/legacy";
import { eraPolicyChoices } from "../rules/policy-deck";

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
      schemaVersion: 21,
      policyElection: legacy.policyElection || { era: legacy.era, choices: eraPolicyChoices(legacy.seed, legacy.era), votes: [] },
      format: legacy.format || "four-era",
      mapId: legacy.mapId === "standard-board" && legacy.hexes.filter((hex) => hex.kind !== "rift").length === 91
        ? "standard-board-91"
        : legacy.mapId === "standard-board" && schemaVersion < 16
          ? "standard-board-61"
          : legacy.mapId === "shattered-reach" && schemaVersion < 16
            ? "shattered-reach-legacy"
            : legacy.mapId || "shattered-reach",
      contentPacks: legacy.contentPacks || [],
      enabledExpansions: legacy.enabledExpansions || ((legacy.contentPacks || []).some((pack) => pack.id === "shattered-reach-expansion") || legacy.players.some((player) => ["spires", "aegis", "wayfarers", "salvo", "guilds"].includes(player.faction)) ? ["shattered-reach-expansion"] : []),
      themeId: legacy.themeId || "horizon-base",
      hexes: legacy.hexes.map((hex) =>
        hex.kind === "hazard" ? { ...hex, kind: "empty" as const } : hex,
      ).map((hex) => ({
        ...hex,
        tier: hex.tier === "Metropolis" && legacy.players[hex.originalOwner ?? hex.owner ?? -1]?.faction === "spires" ? "Arcology" as const : hex.tier,
        arcologyOrigin: hex.tier === "Metropolis" && legacy.players[hex.originalOwner ?? hex.owner ?? -1]?.faction === "spires" ? "spires" : hex.arcologyOrigin,
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
          rulesProfile: player.rulesProfile || factionLibrary[player.faction]?.rulesProfile,
          controller: player.controller || { kind: "human" },
          laborBonus: player.laborBonus || 0,
          laborPenalty: player.laborPenalty || 0,
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
          eraTributes: [...(player.eraTributes || []), 0, 0, 0, 0, 0].slice(0, 5),
          explorationVessels: player.explorationVessels?.length
            ? player.explorationVessels
            : [{
                id: `exploration-${player.id}-1`,
                owner: player.id,
                type: "exploration" as const,
                hex: player.explorer,
                readyTurn: legacy.turn || 1,
                movesRemaining: legacy.moves?.explorer ?? 1,
                publicRevealsTurn: 0,
                publicReveals: 0,
              }],
          colonyShips: Array.isArray(player.colonyShips)
            ? player.colonyShips
            : player.colonyShip
              ? [{
                  id: `colony-${player.id}-1`,
                  owner: player.id,
                  hex: player.colonyShip,
                  readyTurn: legacy.turn || 1,
                  movesRemaining: legacy.moves?.colony ?? 1,
                }]
              : [],
          colonyShip: Array.isArray(player.colonyShips) ? player.colonyShips[0]?.hex || "" : player.colonyShip || "",
          civilizationClaims: player.civilizationClaims || [],
          hiddenLegacy: player.hiddenLegacy || {},
          privateSurveys: player.privateSurveys || [],
          diplomacy: {
            ...player.diplomacy,
            contacts: [],
            firstAgreementPartners: [],
            firstTradeAgreementUsed: false,
            politicalLaborEras: [],
            researchDiscountEras: [],
            technologyExportPartners: [],
            bonusInfluenceGained: 0,
          },
        };
      }),
      moves: {
        explorer: legacy.moves?.explorer ?? 1,
        colony: legacy.moves?.colony ?? 1,
      },
      mode: "inspect",
      carriers: migratedCarriers,
      mobileHabitats: legacy.mobileHabitats || [],
      blockades: (legacy.blockades || []).map((blockade) => {
        const carrier = blockade.carrierId
          ? migratedCarriers.find((candidate) => candidate.id === blockade.carrierId)
          : undefined;
        return carrier
          ? { ...blockade, owner: carrier.owner, hex: carrier.hex, active: false }
          : { ...blockade, carrierId: undefined };
      }),
      bombardmentDamage: legacy.bombardmentDamage || {},
      bombardmentsThisTurn: legacy.bombardmentsThisTurn || {},
      bombardmentMarks: legacy.bombardmentMarks || [],
      civilianUnits: legacy.civilianUnits || [],
      selectedCarrierIds:
        legacy.selectedCarrierIds ||
        migratedCarriers
          .filter((carrier) => carrier.owner === legacy.active)
          .slice(0, 1)
          .map((carrier) => carrier.id),
      agreements: legacy.agreements || [],
      proposals: legacy.proposals || [],
      brokerageOffers: legacy.brokerageOffers || [],
      pendingLabor: legacy.pendingLabor || [],
      stationingPermissions: legacy.stationingPermissions || [],
      universalClaims: legacy.universalClaims || [],
      pendingCombatRedistributions: legacy.pendingCombatRedistributions || [],
      botReports: (legacy.botReports || []).map((report) => ({ ...report, strategicForecast: report.strategicForecast || [], goalAnalysis: report.goalAnalysis || [] })),
      botMemory: legacy.botMemory || [],
      spectatorMode: legacy.spectatorMode || false,
      history: legacy.history || [],
      scenarioId: legacy.scenarioId,
      tutorial: legacy.tutorial,
      academy: legacy.academy,
      resolutionBriefs: legacy.resolutionBriefs || [],
      turnReplays: legacy.turnReplays || [],
      orderProtocol: legacy.orderProtocol ? {
        ...legacy.orderProtocol,
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
