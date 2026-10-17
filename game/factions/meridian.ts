import type { FactionDefinition } from "./types";

export const meridian: FactionDefinition = {
  id: "meridian", name: "The Meridian", role: "Merchant", color: "#62d5ad", logo: "/factions/meridian.png", homeProduction: "currency",
  blurb: "Commercial brokers who begin at Economy II and turn connectivity into value.",
  lore: [
    "The Meridian is less a single nation than a civilization-spanning compact of ports, exchanges, and merchant houses. Its authority rests on the promise that goods, information, and credit will continue moving even when political relationships begin to fail.",
    "Meridian leaders seek leverage in the spaces between rivals. They profit by connecting civilizations that cannot or will not negotiate directly, and they are willing to convert obsolete military capacity back into economic momentum when the market demands it.",
  ],
  abilities: [
    { name: "Commercial Foundation", summary: "Begin at Economy II with 2 Currency and a Currency-producing Homeworld." },
    { name: "First Agreement Free", summary: "The Meridian pays no Influence for its first Trade Agreement." },
    { name: "Brokerage", summary: "Broker one Material, Currency, or Research exchange per civilization pair each Turn. Gain 1 Currency from the first completed Brokerage each Turn; additional trades do not generate Currency." },
    { name: "Economic Salvage", unlock: "Economy III", summary: "Remove 4 controlled Combat Units from Habitats or military vessels to gain 1 Currency. Any vessel left without a CU is destroyed." },
  ],
  objectives: ["Broker: broker 3 civilization-pairs", "Commercial Network: 3 agreements", "Trade Hegemony: earn 8 Currency"],
  initialize(player) { player.resources.currency = 2; player.tech.Economy = 2; },
};
