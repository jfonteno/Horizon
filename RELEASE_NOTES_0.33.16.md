# Horizon 0.33.16

## Persistence and room audit

- An explicitly empty Exploration Vessel list now remains empty after room reload. A destroyed Explorer no longer reappears without construction.
- Room audit hashes are calculated from the same normalized representation that the repositories save and return.
- Human seat claims, profile recovery, local game publication, rematch preparation, and administrator room actions now append audit entries when they advance the room revision.
- D1 room writes use the same normalization as disk and memory storage.
- Existing audit entries are preserved. This release does not rewrite historical audit hashes or claim that older mismatches were verified.

## Faction bot behavior

- Wayfarer bots can issue Migration without a Colony Ship, develop mobile Centers, and value resource extraction from mobile Habitats.
- Farbound bots can Forward Scan and move during the same Turn, and can plan a replacement Explorer after losing one.
- Salvo bots can plan Bombardment without a Colony Ship. Guilds bots redirect Factory production and Aegis bots prioritize their unlocked Blockades.
- Aegis bots can plan Blockade loading, transport toward exposed friendly territory, deployment, and offers to sell surplus Blockades through eligible agreements.
- Bots forecast multiple possible final Era Tributes when valuing future resource production, including Influence in five Era games.
- Expansion factions have more specific technology and construction priorities.

## Validation and limits

Run `npm run typecheck`, `npm test`, and `npm run build` before updating a server. Back up the server data directory before replacing the app; the release archive excludes room and commander records.

Sampled five Era bot games still fell short of the collective Gate target. The resource forecast improves planning but is not a guarantee of Gate success, especially when other players do not contribute. Existing rooms continue from their saved state and historical audit mismatches remain visible.
