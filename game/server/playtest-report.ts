import type { StoredRoom } from "./types";
import { verifyRoomAudit } from "./audit";

export async function createPlaytestReport(room: StoredRoom) {
  const integrity = await verifyRoomAudit(room);
  const last = room.game.history.at(-1);
  const commandCounts = room.audit.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.commandKind] = (counts[entry.commandKind] || 0) + 1;
    return counts;
  }, {});
  const feedbackSummary = room.feedback.length ? {
    responses: room.feedback.length,
    averageRating: Number((room.feedback.reduce((sum, item) => sum + item.rating, 0) / room.feedback.length).toFixed(2)),
    averageDifficulty: Number((room.feedback.reduce((sum, item) => sum + item.difficulty, 0) / room.feedback.length).toFixed(2)),
    wouldPlayAgain: room.feedback.filter((item) => item.wouldPlayAgain).length,
    issueTags: room.feedback.flatMap((item) => item.issueTags).reduce<Record<string, number>>((counts, tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
      return counts;
    }, {}),
  } : { responses: 0, averageRating: null, averageDifficulty: null, wouldPlayAgain: 0, issueTags: {} };
  return {
    format: "horizon-playtest-report",
    formatVersion: 2,
    gameVersion: "0.35.4",
    generatedAt: new Date().toISOString(),
    room: {
      code: room.code,
      name: room.name?.trim() || room.code,
      mode: room.mode,
      status: room.status,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      revision: room.revision,
      turnTimerSeconds: room.turnTimerSeconds,
      turnDeadlineAt: room.turnDeadlineAt,
      durationMs: Math.max(0, Date.parse(room.updatedAt) - Date.parse(room.createdAt)),
    },
    setup: {
      seed: room.game.seed,
      format: room.game.format,
      mapId: room.game.mapId,
      themeId: room.game.themeId,
      contentPacks: room.game.contentPacks || [],
      factions: room.game.players.map((player) => ({
        playerId: player.id,
        civilization: player.name,
        faction: player.faction,
        controller: player.controller,
        startingHex: room.game.hexes.find((hex) => hex.originalOwner === player.id && hex.kind === "home")?.id || null,
      })),
    },
    outcome: {
      turn: room.game.turn,
      era: room.game.era,
      gate: room.game.gate,
      result: room.game.result || null,
      standings: [...room.game.players].sort((a, b) => b.lp - a.lp).map((player) => {
        const metrics = last?.players.find((entry) => entry.playerId === player.id);
        return {
          playerId: player.id,
          civilization: player.name,
          faction: player.faction,
          lp: player.lp,
          resources: metrics?.resources ?? Object.values(player.resources).reduce((sum, value) => sum + value, 0),
          habitats: metrics?.habitats ?? room.game.hexes.filter((hex) => hex.owner === player.id && hex.tier).length,
          trades: metrics?.trades ?? 0,
          tributes: player.tributes,
          legacy: player.legacy,
        };
      }),
    },
    history: room.game.history,
    lifecycle: {
      commandsAccepted: room.audit.length,
      commandCounts,
      seatRecoveries: room.events.filter((event) => event.message.includes("recovered this seat")).length,
      hostTransfers: room.events.filter((event) => event.message.includes("Host authority transferred")).length,
      moderationReports: room.chat.reports.length,
      moderationReportsOpen: room.chat.reports.filter((report) => report.status === "open").length,
      chatMessages: room.chat.messages.filter((message) => message.senderKind !== "system").length,
      turnsRecorded: room.game.history.length,
    },
    objectives: room.game.players.map((player) => ({
      playerId: player.id,
      civilization: player.name,
      universalClaims: room.game.universalClaims.filter((claim) => claim.playerId === player.id),
      civilizationClaims: player.civilizationClaims,
      hiddenLegacy: player.hiddenLegacy,
      legacy: player.legacy,
    })),
    gateLedger: room.game.gateLedger,
    feedback: {
      summary: feedbackSummary,
      responses: room.feedback,
    },
    events: room.events,
    audit: {
      startRevision: room.auditStartRevision ?? null,
      initialStateHash: room.initialStateHash ?? null,
      integrity,
      entries: room.audit,
    },
    replay: {
      deterministic: Boolean(room.initialGame && room.initialStateHash),
      initialGame: room.initialGame || null,
      acceptedCommands: room.audit.map((entry) => ({
        sequence: entry.sequence,
        revision: entry.revision,
        playerId: entry.playerId,
        commandId: entry.commandId,
        command: entry.command,
        expectedStateHash: entry.stateHash,
      })),
      finalGame: room.game,
    },
    diagnostics: {
      resolutionLog: room.game.log,
      lastTurnResolution: room.game.orderProtocol.lastResolution,
      botReports: room.game.botReports,
    },
  };
}
