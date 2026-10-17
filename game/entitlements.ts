import { factionIds, factionLibrary, type FactionId } from "./factions";

export type ExpansionId = "shattered-reach-expansion";
export type EntitlementProvider = "playtest" | "steam" | "apple" | "google" | "web";
export type ContentEntitlement = {
  expansionId: ExpansionId;
  provider: EntitlementProvider;
  status: "active" | "revoked";
  verifiedAt: string;
  offlineUntil: string;
  receiptReference?: string;
};

export const expansionCatalog = {
  "shattered-reach-expansion": {
    id: "shattered-reach-expansion" as const,
    name: "Shattered Reach",
    factionIds: ["spires", "aegis", "wayfarers", "salvo", "guilds"],
    mapIds: ["shattered-reach"],
  },
};

export function playtestEntitlements(now = new Date()): ContentEntitlement[] {
  const offlineUntil = new Date(now);
  offlineUntil.setUTCFullYear(offlineUntil.getUTCFullYear() + 1);
  return [{ expansionId: "shattered-reach-expansion", provider: "playtest", status: "active", verifiedAt: now.toISOString(), offlineUntil: offlineUntil.toISOString() }];
}

export function ownsExpansion(entitlements: ContentEntitlement[] | undefined, expansionId: ExpansionId, at = Date.now()) {
  return Boolean(entitlements?.some((record) => record.expansionId === expansionId && record.status === "active" && Date.parse(record.offlineUntil) >= at));
}

export function expansionForFaction(factionId: string): ExpansionId | undefined {
  return expansionCatalog["shattered-reach-expansion"].factionIds.includes(factionId) ? "shattered-reach-expansion" : undefined;
}

export function availableFactionsForHost(enabledExpansions: ExpansionId[] = []) {
  return factionIds.filter((id) => {
    const expansion = expansionForFaction(id);
    return !expansion || enabledExpansions.includes(expansion);
  });
}

export function contentAccessLabel(factionId: FactionId, entitlements: ContentEntitlement[] | undefined) {
  const expansion = expansionForFaction(factionId);
  if (!expansion) return "Core Set";
  return ownsExpansion(entitlements, expansion) ? "Owned" : `${factionLibrary[factionId].name} requires Shattered Reach`;
}
