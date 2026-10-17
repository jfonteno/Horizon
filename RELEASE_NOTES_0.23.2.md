# Horizon 0.23.2: Lobby Soundtrack

## Added

- A three-track multiplayer lobby playlist: Into the 'Verse, Fighting For the Skies, and The Spelljammer.
- Automatic progression through all three tracks followed by continuous playlist looping.
- A compact lobby music display with current-track title and Play, Pause, Mute, and Next controls.
- A browser-autoplay recovery path that starts music after the player's first interaction and clearly reports when autoplay remains blocked.
- A remembered mute preference for the current browser.
- A restrained default music level so the soundtrack supports the lobby instead of overwhelming conversation.
- Responsive soundtrack controls for desktop, tablet, and phone layouts.

## Playback boundary

Lobby music plays only while the multiplayer room is waiting to launch. It stops when the lobby unmounts or the game begins, so it does not overlap the game board.

## Upgrade

Stop Horizon, back up the complete data directory, extract this release into a new folder, and copy the existing data directory into it. Start with `Start-Horizon-Windows.cmd`. No room migration or tunnel route changes are required.
