# Horizon 0.22.1

Horizon 0.22.1 is a visual and content-registry patch built on the complete 0.22.0 application shell.

## Main menu presentation

- Replaces the previous planet-and-nebula background with original Horizon Gate key art.
- Places the incomplete Gate and fractured system on the right side while preserving low-detail space behind menu controls and title copy.
- Enlarges the Horizon logo in the top navigation and crops its transparent canvas so the visible mark uses the available space.
- Retains responsive behavior for desktop and phone layouts.

## Expansion registry

The expansion screen now records all current additional factions found in the Horizon design archive and distinguishes playable content from documented designs.

- **Shattered Reach:** Spires, Aegis, Wayfarers, Salvo, Guilds
- **Web of Worlds:** Directorate, Consortium, Exchange, Covenant, Junction
- **Spoils of War:** Fabricants, Corsairs, Arsenal, Reclaimers, Pawnbrokers
- **Beyond the Known:** Seekers, Scholarium, Conclave, Archivists
- **Delegate Dawn:** Quintions, Triumvirate, Diaspora, Muses
- **Hidden Hands:** Vectors, House, Mandate, Veil

This is 27 additional documented factions beyond the six playable core civilizations.

The Shattered Reach map remains playable. Its five expansion civilizations and the other 22 listed factions are catalog entries only in 0.22.1. They are not selectable and their special mechanics are not yet active. This avoids presenting partially implemented factions as playable content.

## Compatibility

- Includes every 0.22.0 rule, multiplayer, persistence, Windows, mobile, and application-shell feature.
- Existing room saves remain compatible.
- The Cloudflare Tunnel route does not change.
- Expansion documents and Google Drive files are not required at runtime.

## Upgrade

1. Stop the running Horizon server.
2. Back up the existing `data` directory.
3. Extract 0.22.1 into a new folder.
4. Copy the previous `data` directory into the new folder.
5. Run `Start-Horizon-Windows.cmd`.
6. Reload the public site, using `Ctrl+F5` if the old background remains cached.

