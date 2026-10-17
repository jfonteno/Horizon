import { carrierLibrary, type GameState, type HexState } from "../../../game";
import { hexProduction } from "../../../game/rules/hex-production";
import { productionForecast } from "../../../game/rules/production-forecast";
import { ResourceGlyph } from "./ResourceGlyph";

export default function HexDetails({ game, hex }: { game: GameState; hex: HexState }) {
  const mobiles = game.mobileHabitats.filter((mobile) => mobile.hex === hex.id);
  const blockades = game.blockades.filter((blockade) => blockade.hex === hex.id && blockade.active);
  const carriers = game.carriers.filter((carrier) => carrier.hex === hex.id);
  const stationed = hex.tier ? hex.combat : 0;
  const totalCU = stationed + carriers.reduce((total, carrier) => total + carrier.cu, 0);
  const sources = hex.owner === undefined ? [] : productionForecast(game, hex.owner).sources.filter((source) => source.hexId === hex.id);

  return <details className="hex-production-details">
    <summary>Hex details <strong>{totalCU} total CU</strong><small>Production · Centers · Vessels</small></summary>
    <div className="hex-details-content">
      <section><h4>Production per Turn</h4>
        {sources.length ? <ul>{sources.map((source, index) => <li key={`${source.label}-${index}`}><ResourceGlyph resource={source.resource} label={false}/><span>{source.label}</span><b>+{source.amount} {source.resource}</b></li>)}</ul> : <p>{hexProduction(game, hex)}</p>}
      </section>
      <section><h4>Installed Centers</h4><p>{hex.centers.length ? hex.centers.map((center, index) => <span className={`center-badge ${center === "factory" ? "factory-badge" : hex.enhancedCenterIndices?.includes(index) ? "enhanced-badge" : ""}`} key={`${center}-${index}`}>{center === "defense" ? "Defense Grid" : center === "factory" ? `Factory: ${hex.factoryOutputs?.[index] || "material"}` : `${hex.enhancedCenterIndices?.includes(index) ? "Enhanced " : ""}${center} Center`}</span>) : "None"}{hex.tier === "Arcology" && <span className="center-badge arcology-badge">Spires Arcology</span>}</p></section>
      <section><h4>Combat Units in this hex</h4><p>{stationed} stationed on Habitat · {totalCU} total including vessels</p>
        {carriers.length ? <ul>{carriers.map((carrier) => <li key={carrier.id}><span>{carrierLibrary[carrier.type].name} · {game.players[carrier.owner]?.name || "Unknown owner"}</span><b>{carrier.cu}/{carrierLibrary[carrier.type].capacity} CU</b></li>)}</ul> : <p>No military vessels here.</p>}
      </section>
      {(mobiles.length > 0 || blockades.length > 0) && <section><h4>Other assets</h4><p>{mobiles.map((mobile) => <span className="center-badge mobile-badge" key={mobile.id}>{mobile.type} · {mobile.centers.length} Centers · {mobile.caravanGuards} Guards</span>)}{blockades.map((blockade) => <span className="center-badge blockade-badge" key={blockade.id}>Blockade Platform · 4 CS</span>)}</p></section>}
    </div>
  </details>;
}
