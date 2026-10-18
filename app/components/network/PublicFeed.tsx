import type { GameState } from "../../../game";
import { universalLegacy } from "../../../game/rules/legacy";

export function publicFeedItems(game: GameState) {
  const objectiveNames = new Set(game.universalClaims.map((claim) => universalLegacy.find((item) => item.id === claim.objectiveId)?.name).filter(Boolean));
  const logs = game.log.filter((line) => line.includes("resolved the anomaly at ") ||
    [...objectiveNames].some((name) => name && line.includes(` LP from ${name}.`)));
  return [...new Set(logs)].slice(0, 60).map((text, index) => ({ id: `${index}-${text}`, text, type: text.includes("anomaly") ? "Anomaly" : "Universal Legacy", hexId: text.match(/\b\d+-\d+\b/)?.[0] }));
}

export default function PublicFeed({ game, onOpenHex }: { game: GameState; onOpenHex?: (hexId: string) => void }) {
  const entries = publicFeedItems(game);
  return <div className="public-feed"><header><span>PUBLIC RECORD</span><h3>Events across the Horizon</h3><p>Anomaly rewards and Universal Legacy claims are visible to all civilizations.</p></header><div className="public-feed-items">{entries.map((entry) => <article key={entry.id} className={entry.type === "Anomaly" ? "anomaly" : "legacy"}><b>{entry.type}</b><p>{entry.text}</p>{entry.hexId && onOpenHex && <button onClick={() => onOpenHex(entry.hexId!)}>Locate {entry.hexId}</button>}</article>)}{!entries.length && <p>No public rewards or claims yet.</p>}</div></div>;
}
