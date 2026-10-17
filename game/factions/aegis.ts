import type { FactionDefinition } from "./types";

export const aegis: FactionDefinition = {
  id: "aegis", name: "The Aegis", role: "Defenders", color: "#5fb8c9", logo: "/factions/aegis.png", homeProduction: "material",
  rulesProfile: "aegis", sourcePack: "shattered-reach-expansion", sourcePackVersion: "0.33.3",
  blurb: "Security architects who fortify Habitats and provide defensive platforms to allies.",
  lore: ["The Aegis organize their society around safe routes and defensible settlements. Their fleets carry movable Blockades, allowing a protected frontier to advance with their allies.", "Their first economic Center receives a 1 Currency discount. At Economy II they can commission a new Blockade for another civilization, which pays construction costs and a fee to Aegis. The buyer chooses a controlled deployment hex. Their strength is preparation and positioning rather than quick conquest."],
  abilities: [
    { name: "Enhanced Home Guard", summary: "Controlled Habitats have stronger base Home Guard values." },
    { name: "Aegis Defense Grid", summary: "A Defense Grid adds 2 Home Guard and transfers intact with a captured Habitat." },
    { name: "Blockade Deployment Vessel", unlock: "Military II", summary: "Carries up to 3 Blockades; every other military vessel can carry 1." },
    { name: "First Center Discount", summary: "Your first economic Center costs 1 less Currency. A Currency Center costs 1 Currency instead of 2." },
    { name: "Security Export", unlock: "Economy II", summary: "Offer a newly commissioned Blockade without building it first. The buyer pays 3 Material, 2 Currency, 2 Labor, plus your chosen fee, then deploys it in a controlled hex. Existing Blockades can still be sold to agreement partners." },
  ],
  objectives: ["Fortress Civilization", "Arms for Peace", "Security Provider", "Shield Across the Reach", "Security Architecture"],
  starting: { resources: { material: 1, currency: 1, influence: 1 }, homeCenter: "material" },
};
